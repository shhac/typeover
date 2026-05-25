export function IconFileGeneric(props: { class?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" class={props.class}>
      <path
        d="M3.5 1.75h5.2l3.8 3.8v8.7H3.5z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <path
        d="M8.7 1.75v3.8h3.8"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <path d="M5.5 11.25h5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </svg>
  );
}
