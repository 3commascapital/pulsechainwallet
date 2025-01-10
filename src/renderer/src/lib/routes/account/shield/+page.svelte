<script lang="ts">
  import Crumb from '$lib/components/Crumb.svelte'
  import { crumbs } from '$lib/navigation'
  import SendTransaction from '$lib/components/SendTransaction.svelte'
  import Shield from '$lib/components/transaction/pathways/Shield.svelte'
  import { poolPower } from '$lib/pools'
  import { Offsets } from '$lib/unit'
  import type { TransactionAction } from '$common/types'

  let balance = 0n
  let amount = 0n
  let offset: Offsets = Offsets.Neutral
  let power = $poolPower || 15
  let action: TransactionAction = 'shield'
  let sendButtonText = 'Send'
  let canDeposit: boolean | null = null
  $: {
    if (canDeposit) {
      action = 'shield' as TransactionAction
      sendButtonText = 'Send'
    } else {
      action = 'deploy' as TransactionAction
      sendButtonText = 'Deploy'
    }
  }
</script>

<Crumb {...crumbs.shield} />
<SendTransaction let:updatePrep {action} {sendButtonText}>
  <Shield
    on:change={() => {
      updatePrep()
    }}
    bind:canDeposit
    bind:balance
    bind:amount
    bind:offset
    bind:power />
</SendTransaction>
