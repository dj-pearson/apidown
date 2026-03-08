<script>
  import { page } from '$app/state';

  let {
    title = "APIdown.net — Real API Status from Real Traffic",
    description = "Crowd-sourced, neutral, real-time API health monitoring. Is the API actually down — or is it your code?",
    canonical = null,
    type = "website",
    ogImage = "https://apidown.net/logo-primary.png",
    schema = null,
    noindex = false,
    alternates = [],
  } = $props();

  let canonicalUrl = $derived(canonical || page.url.href.split("?")[0].replace(/\/$/, "") || page.url.href);
</script>

<svelte:head>
  <!-- Primary Meta Tags -->
  <title>{title}</title>
  <meta name="title" content={title} />
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />
  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {:else}
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  {/if}

  <!-- Alternate formats -->
  {#each alternates as alt}
    <link rel="alternate" type={alt.type} href={alt.href} title={alt.title || ''} />
  {/each}

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:site_name" content="APIdown.net" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={canonicalUrl} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImage} />

  <!-- JSON-LD Schema (if provided) -->
  {#if schema}
    {#if Array.isArray(schema)}
      {#each schema as s}
        {@html `<script type="application/ld+json">${JSON.stringify(s)}</script>`}
      {/each}
    {:else}
      {@html `<script type="application/ld+json">${JSON.stringify(schema)}</script>`}
    {/if}
  {/if}
</svelte:head>
