<script lang="ts">
  import { push, location } from 'svelte-spa-router'
  export let prefix!: string

  const layoutLastLocation = `${prefix}:last-location`
  let lastLocation = localStorage.getItem(layoutLastLocation)

  /**
   * @dev Location blacklist and restoration logic
   *
   * @notice Prevents restoring to sensitive/security routes
   * @notice Added '/lock' to blacklist to prevent restoring locked state
   *
   * @dev Blacklist check flow:
   * 1. Check if lastLocation exists
   * 2. Verify lastLocation is not in blacklist
   * 3. Only then restore the location
   *
   * @param lastLocation The previously saved route
   * @returns void - Side effect is route navigation via push()
   *
   * @security Critical for preventing unauthorized access to sensitive routes
   * @security Ensures user must explicitly navigate to secure pages
   */
  const blacklisted = new Set([
    '/locked',
    '/locked/login',
    '/locked/create',
    '/locked/restore',
    '/locked/from-mnemonic',
    '/lock', // Add this to prevent restoring to lock page
  ])

  // Only restore location if it's not a blacklisted route
  if (lastLocation && !blacklisted.has(lastLocation)) {
    push(lastLocation)
  }

  // Don't save lock-related locations
  $: if (!blacklisted.has($location)) {
    localStorage.setItem(layoutLastLocation, $location)
  }
</script>
