export default function debounce(callback: Function, timeout: number) {
  let timer: number | null;

  return (...args: any[]) => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      callback(...args);
      timer = null;
    }, timeout);
  };
}
