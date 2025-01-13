<script lang="ts">
  import AccountSummary from '$lib/components/account/Summary.svelte'
  import { currentAccount } from '$lib/wallets'
  import type { Account } from '$common/wallets'
  import { contactByAddress } from '$lib/contacts'
  import Portal from 'svelte-portal'
  import { createEventDispatcher, onMount } from 'svelte'
  import { stickyFilledOnMount } from '$lib/ui'
  import Back from '../Back.svelte'
  import type { AddressConstraint, AddressMetadata } from '$common/validation'
  import AddressWarnings from '../AddressWarnings.svelte'

  onMount(stickyFilledOnMount)

  const dispatch = createEventDispatcher()
  const sendTransaction = () => {
    dispatch('submit')
  }

  export let account: Account | null = $currentAccount
  export let disabled!: boolean
  export let sendButtonText = 'Send'
  export let toAddressMetadata!: AddressMetadata | null
  export let toAddressConstraints!: AddressConstraint

  $: fromAddress = account?.address
</script>

{#if fromAddress}
  {@const contact = $contactByAddress.get(fromAddress)}
  <div class="flex w-full flex-col">
    <span class="text-sm font-medium italic"
      >From{#if !!contact}: {contact?.name || ''}{/if}</span>
    {#if account}
      <AccountSummary {account} />
    {/if}
  </div>
{/if}
<slot />
{#if toAddressMetadata}
  <AddressWarnings metadata={toAddressMetadata} constraints={toAddressConstraints} />
{/if}
<Portal target="#sticky-portal">
  <div class="flex gap-2 bg-primary-50 px-4 py-2 shadow-inner">
    <button class="variant-filled-primary btn flex w-full opacity-100" on:click={sendTransaction} {disabled}
      >{sendButtonText}</button>
    <Back let:back>
      <button
        type="button"
        class="variant-outline-primary btn"
        on:click={() => {
          back()
        }}>Cancel</button>
    </Back>
  </div>
</Portal>
