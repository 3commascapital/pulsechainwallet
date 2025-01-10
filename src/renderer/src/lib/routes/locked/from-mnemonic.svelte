<script lang="ts">
  import MnemonicInput from '$lib/components/MnemonicInput.svelte'
  import Password from '$lib/components/Password.svelte'

  import { push as goto } from 'svelte-spa-router'

  import { PathTypes } from '$common/path'
  import { wallet } from '$lib/api'

  export let phrase: string[] | null = null
  export let setPassword = false

  const encryptAndSaveWallet = async (password: string) => {
    if (!phrase || !password) return
    if (setPassword) {
      await window.api.password.login(password)
    }
    await wallet.add(phrase.join(' '), PathTypes.BIP44).catch((err) => {
      console.log(err)
      throw err
    })
    goto('/locked/login')
  }
  const handleValidPhrase = (e: CustomEvent<string[]>) => {
    phrase = e.detail
  }
  const handleSubmitPassword = (e: CustomEvent<string>) => {
    encryptAndSaveWallet(e.detail)
  }
</script>

<div class="flex h-full flex-col items-center justify-center px-4">
  {#if !phrase}
    <MnemonicInput
      {phrase}
      on:cancel={() => {
        console.log('from-mnemonic /locked')
        goto('/locked')
      }}
      on:valid-phrase={handleValidPhrase} />
  {:else}
    <Password
      on:cancel={() => {
        phrase = null
      }}
      on:submit={handleSubmitPassword} />
  {/if}
</div>
