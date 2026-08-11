import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    signatureLine: {
      setSignatureLine: () => ReturnType;
    };
  }
}

/** Linha de assinatura centralizada — traço + rótulo abaixo (ex: "Outorgante"). */
export const SignatureLine = Node.create({
  name: "signatureLine",
  group: "block",
  content: "inline*",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="signature-line"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "signature-line",
        style:
          "border-top: 1px solid #1a1a1a; width: 260px; margin: 24px auto 0; padding-top: 6px; text-align: center; font-size: 12px; color: #444;",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSignatureLine:
        () =>
        ({ commands }) =>
          commands.setNode(this.name),
    };
  },
});
