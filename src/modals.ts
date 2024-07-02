import {
  App,
  EventRef,
  FuzzyMatch,
  FuzzySuggestModal,
  Notice,
  renderMatches,
  SearchMatches,
  SearchMatchPart,
  Modal,
  Setting,
  normalizePath,
  TFile
} from 'obsidian';
import CitationPlugin from './main';
import { Entry } from './types';

import { addStr } from './keys';
import { getBibtex } from './retrieve';

// Stub some methods we know are there..
interface FuzzySuggestModalExt<T> extends FuzzySuggestModal<T> {
  chooser: ChooserExt;
}
interface ChooserExt {
  useSelectedItem(evt: MouseEvent | KeyboardEvent): void;
}

class SearchModal extends FuzzySuggestModal<Entry> {
  plugin: CitationPlugin;
  limit = 50;

  loadingEl: HTMLElement;

  eventRefs: EventRef[];

  constructor(app: App, plugin: CitationPlugin) {
    super(app);
    this.plugin = plugin;

    this.resultContainerEl.addClass('zoteroModalResults');

    this.inputEl.setAttribute('spellcheck', 'false');

    this.loadingEl = this.resultContainerEl.parentElement.createEl('div', {
      cls: 'zoteroModalLoading',
    });
    this.loadingEl.createEl('div', { cls: 'zoteroModalLoadingAnimation' });
    this.loadingEl.createEl('p', {
      text: 'Loading citation database. Please wait...',
    });
  }

  onOpen() {
    super.onOpen();

    this.eventRefs = [
      this.plugin.events.on('library-load-start', () => {
        this.setLoading(true);
      }),

      this.plugin.events.on('library-load-complete', () => {
        this.setLoading(false);
      }),
    ];

    this.setLoading(this.plugin.isLibraryLoading);

    // Don't immediately register keyevent listeners. If the modal was triggered
    // by an "Enter" keystroke (e.g. via the Obsidian command dialog), this event
    // will be received here erroneously.
    setTimeout(() => {
      this.inputEl.addEventListener('keydown', (ev) => this.onInputKeydown(ev));
      this.inputEl.addEventListener('keyup', (ev) => this.onInputKeyup(ev));
    }, 200);
  }

  onClose() {
    this.eventRefs?.forEach((e) => this.plugin.events.offref(e));
  }

  getItems(): Entry[] {
    if (this.plugin.isLibraryLoading) {
      return [];
    }

    return Object.values(this.plugin.library.entries);
  }

  getItemText(item: Entry): string {
    return `${item.title} ${item.authorString} ${item.year}`;
  }

  setLoading(loading: boolean): void {
    if (loading) {
      this.loadingEl.removeClass('d-none');
      this.inputEl.disabled = true;
      this.resultContainerEl.empty();
    } else {
      this.loadingEl.addClass('d-none');
      this.inputEl.disabled = false;
      this.inputEl.focus();

      // @ts-ignore: not exposed in API.
      this.updateSuggestions();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onChooseItem(item: Entry, evt: MouseEvent | KeyboardEvent): void {
    this.plugin.openLiteratureNote(item.id, false).catch(console.error);
  }

  renderSuggestion(match: FuzzyMatch<Entry>, el: HTMLElement): void {
    el.empty();
    const entry = match.item;
    const entryTitle = entry.title || '';

    const container = el.createEl('div', { cls: 'zoteroResult' });
    const titleEl = container.createEl('span', {
      cls: 'zoteroTitle',
    });
    container.createEl('span', { cls: 'zoteroCitekey', text: entry.id });

    const authorsCls = entry.authorString
      ? 'zoteroAuthors'
      : 'zoteroAuthors zoteroAuthorsEmpty';
    const authorsEl = container.createEl('span', {
      cls: authorsCls,
    });

    // Prepare to highlight string matches for each part of the search item.
    // Compute offsets of each rendered element's content within the string
    // returned by `getItemText`.
    const allMatches = match.match.matches;
    const authorStringOffset = 1 + entryTitle.length;

    // Filter a match list to contain only the relevant matches for a given
    // substring, and with match indices shifted relative to the start of that
    // substring
    const shiftMatches = (
      matches: SearchMatches,
      start: number,
      end: number,
    ) => {
      return matches
        .map((match: SearchMatchPart) => {
          const [matchStart, matchEnd] = match;
          return [
            matchStart - start,
            Math.min(matchEnd - start, end),
          ] as SearchMatchPart;
        })
        .filter((match: SearchMatchPart) => {
          const [matchStart, matchEnd] = match;
          return matchStart >= 0;
        });
    };

    // Now highlight matched strings within each element
    renderMatches(
      titleEl,
      entryTitle,
      shiftMatches(allMatches, 0, entryTitle.length),
    );
    if (entry.authorString) {
      renderMatches(
        authorsEl,
        entry.authorString,
        shiftMatches(
          allMatches,
          authorStringOffset,
          authorStringOffset + entry.authorString.length,
        ),
      );
    }
  }

  onInputKeydown(ev: KeyboardEvent) {
    if (ev.key == 'Tab') {
      ev.preventDefault();
    }
  }

  onInputKeyup(ev: KeyboardEvent) {
    if (ev.key == 'Enter' || ev.key == 'Tab') {
      ((this as unknown) as FuzzySuggestModalExt<Entry>).chooser.useSelectedItem(
        ev,
      );
    }
  }
}

export class OpenNoteModal extends SearchModal {
  constructor(app: App, plugin: CitationPlugin) {
    super(app, plugin);

    this.setInstructions([
      { command: '↑↓', purpose: 'to navigate' },
      { command: '↵', purpose: 'to open literature note' },
      { command: 'ctrl ↵', purpose: 'to open literature note in a new pane' },
      { command: 'tab', purpose: 'open in Zotero' },
      { command: 'shift tab', purpose: 'open PDF' },
      { command: 'esc', purpose: 'to dismiss' },
    ]);
  }

  onChooseItem(item: Entry, evt: MouseEvent | KeyboardEvent): void {
    if (evt instanceof MouseEvent || evt.key == 'Enter') {
      const newPane =
        evt instanceof KeyboardEvent && (evt as KeyboardEvent).ctrlKey;
      this.plugin.openLiteratureNote(item.id, newPane);
    } else if (evt.key == 'Tab') {
      if (evt.shiftKey) {
        const files = item.files || [];
        const pdfPaths = files.filter((path) =>
          path.toLowerCase().endsWith('pdf'),
        );
        if (pdfPaths.length == 0) {
          new Notice('This reference has no associated PDF files.');
        } else {
          open(`file://${pdfPaths[0]}`);
        }
      } else {
        open(item.zoteroSelectURI);
      }
    }
  }
}

export class InsertNoteLinkModal extends SearchModal {
  constructor(app: App, plugin: CitationPlugin) {
    super(app, plugin);

    this.setInstructions([
      { command: '↑↓', purpose: 'to navigate' },
      { command: '↵', purpose: 'to insert literature note reference' },
      { command: 'esc', purpose: 'to dismiss' },
    ]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onChooseItem(item: Entry, evt: unknown): void {
    this.plugin.insertLiteratureNoteLink(item.id).catch(console.error);
  }
}

export class InsertNoteContentModal extends SearchModal {
  constructor(app: App, plugin: CitationPlugin) {
    super(app, plugin);

    this.setInstructions([
      { command: '↑↓', purpose: 'to navigate' },
      {
        command: '↵',
        purpose: 'to insert literature note content in active pane',
      },
      { command: 'esc', purpose: 'to dismiss' },
    ]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onChooseItem(item: Entry, evt: unknown): void {
    this.plugin.insertLiteratureNoteContent(item.id).catch(console.error);
  }
}

export class InsertCitationModal extends SearchModal {
  constructor(app: App, plugin: CitationPlugin) {
    super(app, plugin);

    this.setInstructions([
      { command: '↑↓', purpose: 'to navigate' },
      { command: '↵', purpose: 'to insert Markdown citation' },
      { command: 'shift ↵', purpose: 'to insert secondary Markdown citation' },
      { command: 'esc', purpose: 'to dismiss' },
    ]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onChooseItem(item: Entry, evt: MouseEvent | KeyboardEvent): void {
    const isAlternative = evt instanceof KeyboardEvent && evt.shiftKey;
    this.plugin
      .insertMarkdownCitation(item.id, isAlternative)
      .catch(console.error);
  }
}


export class BibtexAdderModal extends Modal {
  doiValue: string;
  settings: any;

  constructor(
    app: App,
    settings: any
  ) {
    super(app);
    this.settings = settings;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h1", { text: "Add BibTeX entry from DOI" });

    new Setting(contentEl).setName("DOI").addText((text) =>
      text.setValue(this.doiValue).onChange((value) => {
        this.doiValue = value;
      })
    );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Add")
        .setCta()
        .onClick(async () => {
          this.close();

          let bibtex_path = this.settings.bibtexLocation;

          // Get BibTex data
          var [ bibtex_key, bibtex_string ] = await getBibtex(this.doiValue);

          // Indent BibTeX string
          if (this.settings.indentBibtex) {
            bibtex_string = bibtex_string.replace(
              RegExp(`{${bibtex_key}, title=`, 'g'), `{${bibtex_key},\n  title=`
            )
            bibtex_string = bibtex_string.replace(
              RegExp(`},`, 'g'), `},\n  `
            )
            bibtex_string = addStr(
              bibtex_string, bibtex_string.length-2,
              `\n`
            )
          }

          // Get BibTeX file.
          let bibtexFile = this.app.vault.getAbstractFileByPath(
            normalizePath(bibtex_path)
          ) as TFile;
          
          if (bibtexFile == null) {
            // Create file with BibTeX entry if it does not already exist.
            this.app.vault.create(bibtex_path, bibtex_string);
            new Notice("Created BibTeX file.")
            new Notice(`Added ${bibtex_key}.`)
          } else {
            // File exists.
            // Check if BibTeX key already exists.
            var bibtex_content = await this.app.vault.read(bibtexFile)
            if (bibtex_content.includes(`{${bibtex_key},`)) {
              new Notice(`${bibtex_key} already exists.`)
            } else {
              // Add BibTeX entry at the top of file.
              // When the Citations plugin loads articles it does so in order
              // inside the bib file. To make it easier to find when creating
              // a literature note we put it at the top
              let new_bibtex_content = bibtex_string + bibtex_content;
              this.app.vault.modify(bibtexFile, new_bibtex_content)
              new Notice(`Added ${bibtex_key}.`)
            }
          }
        })
    );
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
