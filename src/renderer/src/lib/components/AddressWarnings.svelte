<script lang="ts">
  import {
    getMismatchedConstraints,
    type AddressCheck,
    type AddressConstraint,
    type AddressMetadata,
  } from '$common/validation'
  import Icon from '@iconify/svelte'
  import _ from 'lodash'

  export let metadata: AddressMetadata | null = null
  export let constraints!: AddressConstraint
  $: mismatchedConstraints = !metadata
    ? new Map<AddressCheck, AddressConstraint>()
    : getMismatchedConstraints(metadata, constraints)
</script>

<div class="btn-container flex flex-wrap gap-2">
  {#each mismatchedConstraints as [check, mismatch]}
    {#if mismatch}
      <div
        class="btn w-auto"
        class:variant-filled-error={mismatch === 'error'}
        class:variant-filled-warning={mismatch === 'warning'}>
        <span>{_.startCase(check)}</span>
        {#if mismatch === 'warning'}
          <Icon icon="material-symbols:warning-outline" width="24" height="24" />
        {:else if mismatch === 'error'}
          <Icon icon="icon-park-solid:error" width="24" height="24" />
        {/if}
      </div>
    {/if}
  {/each}
</div>
