import { writable } from 'svelte/store';

function createToastStore() {
  const { subscribe, set } = writable(null);

  return {
    subscribe,
    show(message, variant = 'info', timeout = 5000) {
      set({ message, variant, timeout });
    },
    error(message) {
      set({ message, variant: 'error', timeout: 0 });
    },
    success(message) {
      set({ message, variant: 'success', timeout: 4000 });
    },
    dismiss() {
      set(null);
    },
  };
}

export const toast = createToastStore();
