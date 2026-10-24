import {useEffect, useState} from 'react';

type PreferredSourceClient = {
  init: (options: {theme: 'light' | 'dark'; lang?: string}) => void;
  addPreferredSource: () => void;
};

type PreferredSourceWindow = Window & {
  PREFERRED_SOURCE?: Array<(client: PreferredSourceClient) => void>;
};

let preferredSourceClientPromise: Promise<PreferredSourceClient> | undefined;

function getPreferredSourceClient() {
  if (!preferredSourceClientPromise) {
    preferredSourceClientPromise = new Promise((resolve) => {
      const preferredSourceWindow = window as PreferredSourceWindow;
      const queue = (preferredSourceWindow.PREFERRED_SOURCE ||= []);
      queue.push((client) => {
        client.init({theme: 'light'});
        resolve(client);
      });
    });
  }

  return preferredSourceClientPromise;
}

export function PreferredSourceButton() {
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    void getPreferredSourceClient();
  }, []);

  const openPreferredSourceFlow = async () => {
    setIsOpening(true);
    try {
      const client = await getPreferredSourceClient();
      client.addPreferredSource();
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <button
      aria-label="Follow Charaideo Reserves as a preferred source"
      className="preferred-source-button"
      disabled={isOpening}
      onClick={openPreferredSourceFlow}
      type="button"
    >
      <img
        alt=""
        aria-hidden="true"
        height="18"
        src="https://www.gstatic.com/images/branding/productlogos/googleg_gradient/v1/24px.svg"
        width="18"
      />
      <span>{isOpening ? 'Opening…' : 'Follow Charaideo stories'}</span>
    </button>
  );
}
