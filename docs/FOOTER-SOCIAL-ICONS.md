# Footer social icons — Issue #54

Replaced four ArtworkDetail crops of footer-master.png with independent SVG brand icons. Transparent outside each logo; no raster image, crop viewport, outer tile, shadow or blended background. Brand silhouettes use Simple Icons paths (CC0): https://github.com/simple-icons/simple-icons/tree/develop/icons (facebook, youtube, tiktok, line). Applied brand colors and white interior contrast for the navy footer; TikTok has cyan/red accents. Brand marks remain their owners' trademarks.

Existing destination URLs, accessible link labels and external-link security attributes retained. Mobile 44px link hit areas retained. Other footer artwork unchanged.

Validated with local fixture at 1440, 375 and 320px: all four SVG files load, HTTPS destinations retained, no horizontal overflow. At <=480px social group spans footer grid to keep all four 44px touch targets on one row. TypeScript and diff whitespace checks pass. Screenshots in docs/qa/footer-social/.
