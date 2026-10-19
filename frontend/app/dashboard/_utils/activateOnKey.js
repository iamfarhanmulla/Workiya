// onKeyDown handler for clickable non-button elements (role="button" / role="option"):
// Enter or Space triggers the element's own onClick, as on a native <button>.
// (The "_utils" folder is private in the Next.js App Router, so it adds no route.)
export default function activateOnKey(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.currentTarget.click();
}
