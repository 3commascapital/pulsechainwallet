<script lang="ts">
  import type { Icon } from '$common/types'
  import SeedBox from './account/SeedBox.svelte'
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  type T = unknown
  export let selected: T = null
  export let icons: Icon[] = []
  const selectWallet = (target: T) => {
    selected = target
    dispatch('select', target)
  }
</script>

<div class="flex w-full flex-row gap-2 overflow-x-scroll rounded bg-white p-1 shadow-inner">
  <ol class="contents">
    {#each icons as icon}
      <li>
        <button
          type="button"
          class="btn relative px-2 shadow"
          class:variant-soft-primary={icon === selected}
          title={icon.title || ''}
          on:click={() => selectWallet(icon)}>
          <SeedBox variant="soft" type={icon.type} />
          <span class="badge-icon absolute right-0.5 top-0.5 flex h-5 min-w-5 bg-neutral-100 px-0.5 text-xs font-light"
            >{icon.badge}</span>
        </button>
      </li>
    {/each}
  </ol>
</div>

<style lang="postcss">
  .badge-icon {
    @apply w-auto;
  }
</style>
