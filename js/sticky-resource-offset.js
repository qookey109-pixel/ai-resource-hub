(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const toolbar = document.querySelector('#market-toolbar');

  const updateOffset = () => {
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
    const offset = Math.ceil(headerHeight + toolbarHeight + 12);
    root.style.setProperty('--resource-sticky-offset', `${offset}px`);
  };

  updateOffset();
  window.addEventListener('resize', updateOffset, { passive: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(updateOffset);
    if (header) observer.observe(header);
    if (toolbar) observer.observe(toolbar);
  }
})();
