<script lang="ts">
  import { push as goto } from 'svelte-spa-router'
  import { password } from '$lib/api'
  import { onMount } from 'svelte'

  password.logout()
  onMount(() => {
    console.log('logout /locked')
    goto('/locked')
  })
</script>
