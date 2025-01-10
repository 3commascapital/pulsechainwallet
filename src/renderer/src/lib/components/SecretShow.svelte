<script lang="ts">
  /**
   * @dev Enhanced Secret Reveal Component
   *
   * Before:
   * @code
   * let secretInvalidMessage = ''
   * const checkPasswordAndReveal = async (e: CustomEvent) => {
   *   const password = e.detail
   *   const shouldReveal = await wallet.reveal(password, walletId, addressIndex)
   *   if (!shouldReveal) {
   *     secretInvalidMessage = 'Invalid password'
   *   } else {
   *     secret = shouldReveal
   *   }
   * }
   * let secret = ''
   *
   * After:
   * - Added wallet type detection
   * - Separate handling for PK and seed phrase wallets
   * - Combined secrets object structure
   * - Enhanced error handling
   * - Improved UI for multiple secret types
   *
   * @notice Changes provide:
   * 1. Support for both private keys and seed phrases
   * 2. Better error messaging
   * 3. Type-specific secret revelation
   * 4. Structured secret storage
   *
   * @security Maintains existing password verification
   * @security Adds type-specific secret handling
   */

  import { CodeBlock, getDrawerStore } from '@skeletonlabs/skeleton'
  import PasswordGate from './PasswordGate.svelte'
  import type { Hex } from 'viem'
  import { wallet } from '$lib/api'
  import { wallets } from '$lib/wallets'

  const drawerStore = getDrawerStore()
  const cancelReveal = () => {
    drawerStore.close()
  }

  let secretInvalidMessage = ''
  const checkPasswordAndReveal = async (e: CustomEvent) => {
    const password = e.detail
    try {
      const walletInfo = $wallets.find((w) => w.id === walletId)
      const isPKWallet = walletInfo?.type === 'pk'

      // For PK wallets, only get private key
      // For seed phrase wallets, get both
      const privateKey = addressIndex !== undefined ? await wallet.reveal(password, walletId, addressIndex) : null
      const seedPhrase = !isPKWallet ? await wallet.reveal(password, walletId) : null

      if (!privateKey && !seedPhrase) {
        secretInvalidMessage = 'Invalid password'
      } else {
        secrets = {
          privateKey: privateKey || '',
          seedPhrase: seedPhrase || '',
        }
      }
    } catch {
      secretInvalidMessage = 'Failed to reveal secrets'
    }
  }

  export let walletId!: Hex
  export let addressIndex: number | undefined = undefined
  let secrets: { privateKey: string; seedPhrase: string } | null = null
</script>

<div class="p-4">
  <h3 class="h3 text-center">Reveal Secrets</h3>
  {#if secrets}
    {#if secrets.privateKey}
      <div class="mb-4">
        <h4 class="h4 mb-2">Private Key</h4>
        <CodeBlock code={secrets.privateKey} />
      </div>
    {/if}
    {#if secrets.seedPhrase}
      <div>
        <h4 class="h4 mb-2">Seed Phrase</h4>
        <CodeBlock code={secrets.seedPhrase} />
      </div>
    {/if}
  {:else}
    {secretInvalidMessage}
    <PasswordGate on:cancel={cancelReveal} on:submit={checkPasswordAndReveal} />
  {/if}
</div>
