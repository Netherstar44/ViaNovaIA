export {};

declare global {
  interface Window {
    /**
     * Handshake between the mobile dock and the lazily mounted assistant:
     * a tap can arrive before the Chatbot chunk finishes loading.
     */
    __vianovaChatRequested?: boolean;
  }
}
