<script lang="ts">
  import Icon from '@iconify/svelte'
  import { type Hex, type SendTransactionParameters, isAddress } from 'viem'
  import { Tab, TabGroup } from '@skeletonlabs/skeleton'
  import { config } from '$lib/config'
  import { wallet, state } from '$lib/api'
  import { chain } from '$lib/chain-state'
  import Prep from '$lib/components/transaction/Prep.svelte'
  import Pay from '$lib/components/transaction/Pay.svelte'
  import { loading } from '$lib/loading'
  import { type PrepConfig, type ViemRawTransaction } from '$lib/transactions'
  import BroadcastTransaction from '$lib/components/transaction/Broadcast.svelte'
  import { currentAccount as account } from '$lib/wallets'
  import { onMount, tick } from 'svelte'
  import type { TransactionAction } from '$common/types'
  import { emptyHex, type ChainIds } from '$common/config'
  import { getMismatchedConstraints, type AddressConstraint, type AddressMetadata } from '$common/validation'

  export let action!: TransactionAction
  export let sendButtonText = 'Send'
  let toAddressMetadata: AddressMetadata | null = null
  export let toAddressConstraints: AddressConstraint = new Map()
  let anyErrors = false

  export const updatePrep = async () => {
    await tick()
    const formData = new FormData(form)
    prep = [...formData.entries()].reduce((inputs, [key, value]) => {
      if (key === 'to-address') {
        if (!isAddress(value as string)) {
          return inputs
        }
        inputs.to = value as Hex
      } else if (key === 'from-address') {
        if (!isAddress(value as string)) {
          throw new Error('from address invalid')
        }
        if (value !== $account?.address) {
          throw new Error('account not loaded')
        }
        inputs.from = $account
      } else if (key === 'value') {
        inputs.value = BigInt(value as string)
      } else if (key === 'data') {
        inputs.data = value as Hex
      } else if (key === 'gas') {
        inputs.gas = BigInt(value as string)
      }
      return inputs
    }, {} as Partial<PrepConfig>) as PrepConfig
    if (prep.to && toAddressConstraints.size) {
      // check if it's a contract
      anyErrors = true
      state.addressInfo($chain!.id! as ChainIds, prep.to).then((res) => {
        toAddressMetadata = res
        if (res) {
          const conflicts = getMismatchedConstraints(res, toAddressConstraints)
          anyErrors = Array.from(conflicts.values()).some((mismatch) => mismatch === 'error')
        }
      })
    } else {
      anyErrors = false
    }
  }
  const setToValue = (value: number) => {
    if (value < tabSet) {
      tabSet = value
    }
  }
  const handleConfirm = async (e: CustomEvent) => {
    const payconfig = e.detail as ViemRawTransaction
    pay = payconfig
    tabSet = 2
    const chainId = $config.chainId
    if (!$account) {
      throw new Error('account not loaded')
    }
    hash = await wallet.sendTransaction(chainId, $account, payconfig as unknown as SendTransactionParameters, action)
  }

  export let prep: PrepConfig | null = null
  export let pay: ViemRawTransaction | null = null

  let tabSet: number = 0
  const increment = () => loading.increment('transaction')
  const decrement = () => loading.decrement('transaction')
  $: if (tabSet > 0) {
    if (!$loading.categories.transaction) {
      // presumes we are the only one in control of this
      increment()
    }
  } else {
    decrement()
  }
  onMount(() => () => {
    if ($loading.isResolved('transaction')) {
      return
    }
    decrement()
  })

  let hash: Hex = emptyHex
  let form!: HTMLFormElement
  $: prepSubmitDisabled = !isAddress((prep?.to || '') as unknown as Hex) || anyErrors
</script>

<div class="flex w-full px-4">
  <TabGroup class="flex w-full flex-col">
    <Tab padding="p-0" bind:group={tabSet} name="tab1" value={0}>
      <button on:click={() => setToValue(0)} type="button" class="flex flex-row gap-2 px-4 py-2">
        <Icon icon="system-uicons:write" height={24} />
        <span>Prepare</span>
      </button>
    </Tab>
    <Tab padding="p-0" bind:group={tabSet} name="tab2" value={1}>
      <button
        on:click={() => setToValue(1)}
        type="button"
        class="flex flex-row gap-2 px-4 py-2"
        class:text-neutral-400={tabSet < 1}>
        <Icon icon="mdi:gas" height={24} />
        <span>Pay</span>
      </button>
    </Tab>
    <Tab padding="p-0" bind:group={tabSet} name="tab3" value={2}>
      <button
        on:click={() => setToValue(2)}
        type="button"
        class="flex flex-row gap-2 px-4 py-2"
        class:text-neutral-400={tabSet < 2}>
        <Icon icon="ph:broadcast" height={24} />
        <span>Broadcast</span>
      </button>
    </Tab>
    <svelte:fragment slot="panel">
      {#if tabSet === 0}
        <div class="w-full">
          <div class="flex flex-col gap-4 pb-4">
            <form bind:this={form} class="contents">
              <Prep
                {sendButtonText}
                account={$account}
                disabled={prepSubmitDisabled}
                {toAddressMetadata}
                {toAddressConstraints}
                on:submit={() => {
                  tabSet = 1
                }}><slot {prep} {updatePrep} /></Prep>
            </form>
          </div>
        </div>
      {:else if tabSet === 1 && prep}
        <div class="w-full">
          <Pay
            {prep}
            on:confirm={handleConfirm}
            on:back={() => {
              tabSet = 0
            }} />
        </div>
      {:else if tabSet === 2}
        <div class="w-full">
          <BroadcastTransaction bind:hash />
        </div>
      {/if}
    </svelte:fragment>
  </TabGroup>
</div>
