<script>
    import { page } from "$app/stores";

    export let title = "APIdown.net — Real API Status from Real Traffic";
    export let description =
        "Crowd-sourced, neutral, real-time API health monitoring. Is the API actually down — or is it your code?";
    export let canonical = null;
    export let url = $page.url.href;
    export let type = "website";
    export let ogImage = "https://apidown.net/logo-primary.png";
    export let schema = null;
    export let noindex = false;
    export let alternates = [];

    $: canonicalUrl = canonical || url.split("?")[0].replace(/\/$/, "") || url;
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
                <script type="application/ld+json">
                    {@html JSON.stringify(s)}
                </script>
            {/each}
        {:else}
            <script type="application/ld+json">
                {@html JSON.stringify(schema)}
            </script>
        {/if}
    {/if}
</svelte:head>
