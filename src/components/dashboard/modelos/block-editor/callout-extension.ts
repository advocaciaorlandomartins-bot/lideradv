import { Node, mergeAttributes } from "@tiptap/core";

export interface CalloutAttrs {
  color?: string;
  title?: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: CalloutAttrs) => ReturnType;
    };
  }
}

/**
 * Caixa destacada com borda/fundo colorido e título opcional — reproduz o
 * estilo de cláusula em caixa (A, B, C…) do contrato de referência.
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "inline*",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      color: { default: "#1E3A8A" },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const color = (node.attrs.color as string) || "#1E3A8A";
    const title = node.attrs.title as string | null;
    const wrapper = mergeAttributes(HTMLAttributes, {
      "data-type": "callout",
      style: `border-left: 3px solid ${color}; background: ${color}14; padding: 10px 12px; border-radius: 4px; margin: 6px 0;`,
    });
    if (title) {
      return [
        "div",
        wrapper,
        [
          "div",
          { style: `font-weight: 700; color: ${color}; margin-bottom: 4px;` },
          title,
        ],
        // O "content hole" (0) precisa ser o único filho do seu pai direto —
        // por isso fica isolado num wrapper próprio, ao lado do título.
        ["div", {}, 0],
      ];
    }
    return ["div", wrapper, 0];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.setNode(this.name, attrs),
    };
  },
});
