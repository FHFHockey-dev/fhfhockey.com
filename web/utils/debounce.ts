export default function debounce(
  callback: Function,
  timeout: number,
  immediate: boolean = false
) {
  let timer: number | undefined;

  return (...args: any[]) => {
    const callNow = immediate && !timer;
    if (callNow) {
      callback(...args);
    }

    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      if (!immediate) {
        callback(...args);
      }
    }, timeout);
  };
}
