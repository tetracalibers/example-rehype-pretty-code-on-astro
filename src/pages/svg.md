```html showLineNumbers {2-4,6}
<svg width="250" height="250" viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="box-shadow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect fill="#D2E0FB" filter="url(#box-shadow)" x="25" y="25" width="200" height="200" />
</svg>
```