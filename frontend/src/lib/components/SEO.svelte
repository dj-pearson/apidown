<script>
    import { page } from "$app/stores";

    export let title = "APIdown.net — Real API Status from Real Traffic";
    export let description =
        "Crowd-sourced, neutral, real-time API health monitoring. Is the API actually down — or is it your code?";
    export let url = $page.url.href;
    export let type = "website";
    export let ogImage = "https://apidown.net/logo-primary.png";
    export let schema = null;
</script>

<svelte:head>
    <!-- Primary Meta Tags -->
    <title>{title}</title>
    <meta name="title" content={title} />
    <meta name="description" content={description} />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content={type} />
    <meta property="og:url" content={url} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={ogImage} />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content={url} />
    <meta property="twitter:title" content={title} />
    <meta property="twitter:description" content={description} />
    <meta property="twitter:image" content={ogImage} />

    <!-- JSON-LD Schema (if provided) -->
    {#if schema}
        <script type="application/ld+json">
            {@html JSON.stringify(schema)}
        </script>
    {/if}
</svelte:head>
