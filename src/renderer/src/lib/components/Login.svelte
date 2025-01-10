<script lang="ts">
  export let message = ''
  import { push } from 'svelte-spa-router'
  import { onMount } from 'svelte'
  import BackButton from './BackButton.svelte'
  import * as wallets from '$lib/wallets'
  const { hasWallets } = wallets
  import { password } from '$lib/api'
  const resetMessage = () => {
    if (msg) {
      message = msg
    }
  }
  const attemptUnlock = async () => {
    const correct = await password.login(pass)
    if (correct) {
      push('/account')
    } else {
      msg = msg || message
      message = 'incorrect password'
      pass = ''
    }
  }
  let pass = ''
  let msg = ''
  $: disabled = pass.length === 0
  onMount(() => {
    if (!$hasWallets) {
      // if your storage ever gets wiped, we cannot
      // attempt to unlock a wallet that does not exist
      push('/locked/create')
    }
  })
</script>

<div class="flex h-full w-full flex-col items-center justify-center p-4">
  <p class="my-4">{message}</p>
  <form on:submit|preventDefault={attemptUnlock} class="w-full">
    <input
      on:input={resetMessage}
      class="input text-center leading-6"
      placeholder="***"
      type="password"
      tabindex="0"
      bind:value={pass} />

    <div class="mt-4 grid grid-cols-2 gap-2">
      <BackButton
        cancelText="Reset"
        on:cancel={() => {
          push('/locked/restore')
        }} />
      <button type="submit" {disabled} class="variant-filled-primary btn">Login</button>
    </div>
  </form>
</div>
