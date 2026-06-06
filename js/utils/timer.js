export function sleep(millisecond) {
  return new Promise(function(resolve) {
    setTimeout(resolve, millisecond);
  });
}