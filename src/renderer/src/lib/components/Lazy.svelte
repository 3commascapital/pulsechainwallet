<script lang="ts">
  import { lazyload } from '../modifiers/lazyload'
  export let height = 1
  let className = ''
  let load = false
  export let visible = (e: CustomEvent<boolean>) => {
    load = !!e.detail
  }
  export { className as class }
</script>

<div class={className} use:lazyload on:visible={visible} style={`height: ${height}px`}>
  <slot {load} />
</div>
