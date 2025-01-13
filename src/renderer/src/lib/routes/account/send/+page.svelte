<script lang="ts">
  import SendTransaction from '$lib/components/SendTransaction.svelte'
  import Send from '$lib/components/transaction/pathways/Send.svelte'
  import { tokensOnActiveChain, whitelistedERC20 } from '$lib/tokens'
  import type { Erc20Token } from '$common/token'
  import type { Hex } from 'viem'
  import Crumb from '$lib/components/Crumb.svelte'
  import { crumbs } from '$lib/navigation'
  import { emptyHex } from '$common/config'
  import { defaultToAddressConstraints } from '$common/validation'

  let balance = 0n
  let amount = 0n
  let toValue = ''
  let toAddress: Hex = emptyHex
  let token: Erc20Token = whitelistedERC20[0]

  $: if ($tokensOnActiveChain) {
    if (!$tokensOnActiveChain.includes(token)) {
      token = $tokensOnActiveChain[0]
    }
  }
</script>

<Crumb {...crumbs.send} />

<SendTransaction let:updatePrep action="send" toAddressConstraints={defaultToAddressConstraints}>
  <!--
  bind all values here so that they are
  maintained as tabs are flipped back and forth
  -->
  <Send bind:token bind:toValue bind:toAddress bind:balance bind:amount on:change={updatePrep} />
</SendTransaction>
