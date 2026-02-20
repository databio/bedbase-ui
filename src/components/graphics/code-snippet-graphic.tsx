import { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import rust from 'highlight.js/lib/languages/rust';
import 'highlight.js/styles/github.css';

hljs.registerLanguage('python', python);
hljs.registerLanguage('r', r);
hljs.registerLanguage('rust', rust);

const snippets = [
  {
    language: 'Python',
    hlLang: 'python',
    code: `from geniml.bbclient import BBClient

bbclient = BBClient()

regionset = bbclient.load_bed("02c7821a715f1f890ed2ae53d371072b")
print(regionset)`,
  },
  {
    language: 'R',
    hlLang: 'r',
    code: `library(bedbaser)

api <- BEDbase()

bed_granges <- bb_to_granges(api, "02c7821a715f1f890ed2ae53d371072b")
print(bed_granges)`,
  },
  {
    language: 'Rust',
    hlLang: 'rust',
    code: `use gtars::bbclient::BBClient;

let mut bbc = BBClient::new(Some(cache_folder.clone()), None)
    .expect("Failed to create BBClient");

let bed_id: String = bbc
    .add_local_bed_to_cache(PathBuf::from(_path/to.bed.gz), None)
    .unwrap();`,
  },
];

export function CodeSnippetGraphic() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[active].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const highlighted = useMemo(
    () => hljs.highlight(snippets[active].code, { language: snippets[active].hlLang }).value,
    [active],
  );

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        {snippets.map((s, i) => (
          <button
            key={s.language}
            onClick={() => setActive(i)}
            className={`text-[11px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
              active === i
                ? 'bg-primary text-primary-content'
                : 'text-base-content/50 hover:text-base-content hover:bg-base-200'
            }`}
          >
            {s.language}
          </button>
        ))}
        <button
          onClick={handleCopy}
          className="ml-auto p-1 rounded text-base-content/30 hover:text-base-content/60 hover:bg-base-200 transition-colors cursor-pointer"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="flex-1 overflow-auto px-3 pb-2 !bg-transparent">
        <code
          className="!bg-transparent text-[11px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}
