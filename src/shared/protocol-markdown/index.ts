import type { Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";

interface ProtocolContentExtensionOptions {
  onReadOnlyTaskChecked?: (
    node: { textContent: string },
    checked: boolean,
  ) => boolean;
}

export function createProtocolContentExtensions(
  options: ProtocolContentExtensionOptions = {},
): Extensions {
  return [
    StarterKit.configure({
      link: {
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      onReadOnlyChecked: options.onReadOnlyTaskChecked,
    }),
    TableKit,
    Image.configure({ allowBase64: true }),
  ];
}
