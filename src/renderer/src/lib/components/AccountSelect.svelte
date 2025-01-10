<script lang="ts">
  import Icon from '@iconify/svelte'
  import { push as goto } from 'svelte-spa-router'
  import { addedAccounts } from '$lib/wallets'
  import { config } from '$lib/config'
  import { type Account } from '$common/wallets'
  import { crumbs } from '$lib/navigation'
  import { getDrawerStore } from '@skeletonlabs/skeleton'
  import AccountList from './AccountList.svelte'

  const drawerStore = getDrawerStore()
  const gotoManageAddresses = () => {
    goto(crumbs.manageAddresses.link!)
    drawerStore.close()
  }

  let filter = ''
  export let current!: Account
  const selectAddress = async (e: CustomEvent<Account>) => {
    config.updatePartial('.', {
      walletId: e.detail.wallet_id,
      addressIndex: e.detail.address_index,
    })
    current = e.detail
  }
</script>

<div class="flex w-full flex-col gap-2 p-4 text-center">
  <h3 class="h3">Select Account</h3>
  <div class="flex flex-row items-center justify-between">
    <div class="input-group input-group-divider variant-outline-primary flex flex-row items-center">
      <span class="input-group-shim px-1">
        <Icon icon="material-symbols:search" height={20} />
      </span>
      <input type="text" class="flex w-full py-0" bind:value={filter} placeholder="Search" />
    </div>
    <div class="flex w-full flex-row justify-end">
      <button type="button" class="flex flex-row items-center gap-2" on:click={gotoManageAddresses}>
        <span>Manage Addresses</span>
        <Icon icon="lucide:contact-round" />
      </button>
    </div>
  </div>
  {#if $config.walletId}
    <AccountList
      accounts={$addedAccounts}
      currentAddress={current.address}
      on:select={selectAddress}
      itemButtons={['showPK', 'copy']} />
  {/if}
</div>
