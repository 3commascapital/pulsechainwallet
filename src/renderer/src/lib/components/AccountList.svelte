<script lang="ts">
  import { defaultName, type Account, type WalletMetadata } from '$common/wallets'
  import Icon from '@iconify/svelte'
  import SeedBox from './account/SeedBox.svelte'
  import Address from './Address.svelte'
  import Copy from './Copy.svelte'
  import Select from './Select.svelte'
  import { getAddress, type Hex } from 'viem'
  import { push as goto } from 'svelte-spa-router'
  import { createEventDispatcher } from 'svelte'
  import Hover from './Hover.svelte'
  import { getDrawerStore } from '@skeletonlabs/skeleton'
  import { wallets } from '$lib/wallets'
  import * as api from '$lib/api'
  import { contactByAddress } from '$lib/contacts'

  export let currentAddress!: Hex
  export let accounts!: Account[]
  export let itemButtons: string[] = ['showPK', 'copy']
  export let walletId: Hex | undefined = undefined

  // Create a map to store wallet metadata for each account
  let walletMetadataMap: Map<Hex, WalletMetadata | null> = new Map()

  /**
   * @dev Changes from single wallet reference to multi-wallet map structure
   *
   * Before:
   * - Single wallet metadata storage
   * - Simple promise chain for fetching
   * - No error handling
   * @code
   * let wallet: WalletMetadata | null = null
   * $: {
   *   const known = $wallets.find((w) => w.id === walletId)
   *   if (known) {
   *     wallet = known
   *   } else {
   *     api.wallet.get(walletId).then((w) => {
   *       wallet = w
   *     })
   *   }
   * }
   *
   * After:
   * - Map-based metadata storage for multiple wallets
   * - Reactive updates for all accounts
   * - Proper error handling
   * - Manual reactivity triggers
   * - Helper function for safe access
   *
   * @notice Changes improve:
   * 1. Multi-wallet support
   * 2. Error resilience
   * 3. State management
   * 4. Type safety
   *
   * @dev Manual reactivity triggers needed due to Map mutations
   */
  $: {
    accounts.forEach(async (account) => {
      const id = walletId || account.wallet_id
      const known = $wallets.find((w) => w.id === id)
      if (known) {
        walletMetadataMap.set(id, known)
        walletMetadataMap = walletMetadataMap // Trigger reactivity
      } else {
        try {
          const w = await api.wallet.get(id)
          walletMetadataMap.set(id, w)
          walletMetadataMap = walletMetadataMap // Trigger reactivity
        } catch (e) {
          console.error('Failed to fetch wallet metadata:', e)
          walletMetadataMap.set(id, null)
          walletMetadataMap = walletMetadataMap // Trigger reactivity
        }
      }
    })
  }

  // Helper function to get wallet metadata with proper type handling
  const getWalletMetadata = (id: Hex): WalletMetadata | null => {
    return walletMetadataMap.get(id) || null
  }

  const gotoAddressDetails = (addressIndex: number) => {
    const id = walletId || accounts[0]?.wallet_id
    if (id) {
      goto(`/account/addresses/${id}/detail/${addressIndex}`)
    }
  }

  const dispatch = createEventDispatcher()
  const selectAddress = (derived: Account) => {
    dispatch('select', derived)
  }

  const drawerStore = getDrawerStore()
  const showSecrets = (derived: Account) => {
    drawerStore.open({
      id: 'secret-show',
      position: 'bottom',
      meta: {
        walletId: walletId || derived.wallet_id,
        addressIndex: derived.address_index,
      },
    })
  }
  const p = 'phrase' as const
  const userOrder = (wallet: WalletMetadata | null) => wallet?.user_order || 0
</script>

<ol class="flex w-full flex-col gap-2">
  {#each accounts as derived}
    {@const wallet = getWalletMetadata(walletId || derived.wallet_id)}
    <li class="flex w-full items-center justify-stretch rounded bg-white shadow">
      <Hover let:hovering>
        {@const selected = !!currentAddress && getAddress(currentAddress) === getAddress(derived.address)}
        {@const contact = $contactByAddress.get(derived.address)}
        <button
          type="button"
          class="flex w-full flex-row items-center justify-between px-2 py-1"
          on:click={() => selectAddress(derived)}>
          <div class="flex w-full flex-row items-center justify-start gap-2">
            <SeedBox variant="soft" type={wallet?.type} />
            <div class="flex flex-col justify-start text-left leading-4">
              <p>{contact?.name || defaultName(wallet?.type || p, userOrder(wallet), derived.address_index)}</p>
              <p class="flex flex-row text-sm font-light">
                <Address address={derived.address} />
              </p>
            </div>
          </div>
          <div class="flex flex-row items-center gap-2">
            <Select show={hovering || selected} color={hovering && !selected ? 'inactive' : 'success'} />
            {#if itemButtons.includes('showPK')}
              <div class="tooltip-wrapper">
                <button
                  type="button"
                  class="variant-soft-primary size-8 rounded p-2"
                  on:click={() => showSecrets(derived)}>
                  <Icon icon="mdi:eye-lock-open-outline" />
                </button>
                <div class="tooltip-text">Show Secrets</div>
              </div>
            {/if}
            {#if itemButtons.includes('copy')}
              <div class="tooltip-wrapper">
                <Copy text={derived.address} let:copy let:copied>
                  <button
                    type="button"
                    class="variant-soft-primary size-8 rounded p-2 px-2"
                    on:click|stopPropagation={copy}>
                    {#if copied}
                      <Icon icon="icon-park-outline:file-success-one" height={12} width={12} />
                    {:else}
                      <Icon icon="fa:copy" height={12} width={12} />
                    {/if}
                  </button>
                  <div class="tooltip-text">Copy Address</div>
                </Copy>
              </div>
            {/if}
          </div>
        </button>
      </Hover>
      <div class="tooltip-wrapper">
        <button
          type="button"
          class="variant-filled-primary m-0 flex items-center justify-center rounded-r border-l p-3 hover:border-l"
          on:click={() => gotoAddressDetails(derived.address_index)}>
          <Icon icon="gravity-ui:circle-chevron-right" height={20} />
        </button>
        <div class="tooltip-text">View Details</div>
      </div>
    </li>
  {/each}
</ol>
