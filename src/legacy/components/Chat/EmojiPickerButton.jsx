import { useEffect, useRef, useState } from 'react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import styles from '../../styles/Chat.module.css';

export default function EmojiPickerButton({
  onEmojiSelect,
  disabled = false,
}) {
  const [aberto, setAberto] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;

    const fecharAoClicarFora = (event) => {
      if (pickerRef.current?.contains(event.target)) return;
      setAberto(false);
    };

    const fecharComEsc = (event) => {
      if (event.key === 'Escape') {
        setAberto(false);
      }
    };

    document.addEventListener('mousedown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEsc);

    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEsc);
    };
  }, [aberto]);

  return (
    <div className={styles.emojiPickerWrapper} ref={pickerRef}>
      <button
        type="button"
        className={styles.attachButton}
        title="Adicionar emoji"
        onClick={() => setAberto((atual) => !atual)}
        disabled={disabled}
      >
        <Smile size={17} />
      </button>

      {aberto && (
        <div className={styles.emojiPickerPopover}>
          <EmojiPicker
            theme={document.documentElement.dataset.theme === 'claro' ? Theme.LIGHT : Theme.DARK}
            lazyLoadEmojis
            emojiStyle={EmojiStyle.NATIVE}
            searchPlaceHolder="Buscar emoji"
            previewConfig={{ showPreview: false }}
            onEmojiClick={(emojiData) => {
              onEmojiSelect(emojiData.emoji);
            }}
            width="100%"
            height={360}
          />
        </div>
      )}
    </div>
  );
}
