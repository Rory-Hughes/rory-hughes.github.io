import type { EditorView } from "codemirror";
import { createBrowserDraftStore } from "../lib/browser-draft-store.mjs";

interface EncodedSources { [id: string]: string; }

const dialog = document.querySelector<HTMLDialogElement>(".code-excerpt-dialog");
const sourceNode = document.querySelector<HTMLScriptElement>("#code-excerpt-sources");
const titleNode = document.querySelector<HTMLElement>("#code-excerpt-dialog-title");
const statusNode = document.querySelector<HTMLElement>("[data-excerpt-status]");
const loadingNode = document.querySelector<HTMLElement>("[data-excerpt-loading]");
const editorHost = document.querySelector<HTMLElement>("[data-excerpt-editor]");
const copyButton = document.querySelector<HTMLButtonElement>("[data-excerpt-copy]");
const resetButton = document.querySelector<HTMLButtonElement>("[data-excerpt-reset]");
const closeButton = document.querySelector<HTMLButtonElement>("[data-excerpt-close]");

if (dialog && sourceNode && titleNode && statusNode && loadingNode && editorHost && copyButton && resetButton && closeButton) {
  const encodedSources = JSON.parse(sourceNode.textContent ?? "{}") as EncodedSources;
  const draftStore = createBrowserDraftStore(() => window.localStorage);
  const projectSlug = dialog.dataset.projectSlug ?? "project";
  let editor: EditorView | undefined;
  let editorPromise: Promise<typeof import("codemirror")> | undefined;
  let currentExcerptId = "";
  let originalSource = "";
  let returnFocusTo: HTMLElement | null = null;
  let saveTimer: number | undefined;
  let suppressPersistence = false;

  const storageKey = (id: string) => "rory-hughes-portfolio:" + projectSlug + "-excerpt:v1:" + id;
  const setStatus = (message: string, kind: "saved" | "warning" | "plain" = "plain") => {
    statusNode.textContent = message;
    statusNode.dataset.kind = kind;
  };
  const decodeSource = (value: string) => {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };
  const persistDraft = (id: string, value: string) => {
    const result = draftStore.write(storageKey(id), value);
    if (result.saved) {
      setStatus("Draft saved in this browser. It never changes the source file.", "saved");
    } else {
      setStatus("Browser storage is unavailable. This draft stays in memory until you close this page; it was not saved.", "warning");
    }
  };
  const getEditor = async () => {
    editorPromise ??= import("codemirror");
    const { basicSetup, EditorView } = await editorPromise;
    if (!editor) {
      const [{ markdown }, { languages }, { oneDark }] = await Promise.all([
        import("@codemirror/lang-markdown"),
        import("@codemirror/language-data"),
        import("@codemirror/theme-one-dark"),
      ]);
      editor = new EditorView({
        parent: editorHost,
        extensions: [
          basicSetup,
          markdown({ codeLanguages: languages }),
          oneDark,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": "Complete editable Markdown source" }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || suppressPersistence || !currentExcerptId) return;
            const value = update.state.doc.toString();
            const excerptId = currentExcerptId;
            window.clearTimeout(saveTimer);
            saveTimer = window.setTimeout(() => {
              saveTimer = undefined;
              persistDraft(excerptId, value);
            }, 240);
          }),
        ],
      });
    }
    return editor;
  };

  const closeDialog = () => {
    if (dialog.open) dialog.close();
  };

  document.querySelectorAll<HTMLButtonElement>("[data-code-excerpt-trigger]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.excerptId;
      const encoded = id ? encodedSources[id] : undefined;
      if (!id || !encoded) return;

      currentExcerptId = id;
      returnFocusTo = button;
      originalSource = decodeSource(encoded);
      titleNode.textContent = button.getAttribute("aria-labelledby")
        ? document.getElementById(button.getAttribute("aria-labelledby") ?? "")?.textContent ?? "Code excerpt"
        : "Code excerpt";
      copyButton.disabled = true;
      resetButton.disabled = true;
      loadingNode.hidden = false;
      setStatus("Loading the complete Markdown source…");
      if (!dialog.open) dialog.showModal();

      try {
        const view = await getEditor();
        if (currentExcerptId !== id) return;

        const draftResult = draftStore.read(storageKey(id));
        const savedDraft = draftResult.value;
        const storageAvailable = draftResult.storageAvailable;
        const text = savedDraft ?? originalSource;
        suppressPersistence = true;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          selection: { anchor: 0 },
        });
        view.scrollDOM.scrollTop = 0;
        suppressPersistence = false;
        view.focus();
        copyButton.disabled = false;
        resetButton.disabled = false;
        loadingNode.hidden = true;

        if (!storageAvailable) {
          draftStore.retain(storageKey(id), text);
          setStatus("Browser storage is unavailable. Edits stay in memory until you close this page; they are not saved.", "warning");
        } else if (savedDraft !== null) {
          setStatus("Your saved browser draft was restored. Reset to original clears it.", "saved");
        } else {
          setStatus("Editing the supplied original. Drafts save in this browser and never change the source repository.");
        }
      } catch (error) {
        console.error("Code excerpt editor failed to load.", error);
        suppressPersistence = false;
        loadingNode.hidden = true;
        setStatus("The editor could not load. Close the dialog and try again.", "warning");
      }
    });
  });

  copyButton.addEventListener("click", async () => {
    if (!editor) return;
    try {
      await navigator.clipboard.writeText(editor.state.doc.toString());
      setStatus("Complete Markdown copied to the clipboard.", "saved");
    } catch {
      setStatus("Clipboard access is unavailable in this browser.", "warning");
    }
  });

  resetButton.addEventListener("click", () => {
    if (!editor || !currentExcerptId) return;
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
    const reset = draftStore.clear(storageKey(currentExcerptId));
    suppressPersistence = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: originalSource },
      selection: { anchor: 0 },
    });
    editor.scrollDOM.scrollTop = 0;
    suppressPersistence = false;
    if (!reset.cleared) draftStore.retain(storageKey(currentExcerptId), originalSource);
    setStatus(
      reset.cleared
        ? "Original Markdown restored and the saved draft cleared."
        : "Original Markdown restored for this page. Browser storage is unavailable, so the reset could not clear an older saved copy.",
      reset.cleared ? "saved" : "warning",
    );
  });

  closeButton.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", () => {
    if (saveTimer !== undefined && editor && currentExcerptId) {
      window.clearTimeout(saveTimer);
      saveTimer = undefined;
      persistDraft(currentExcerptId, editor.state.doc.toString());
    }
    returnFocusTo?.focus();
    returnFocusTo = null;
  });
}
