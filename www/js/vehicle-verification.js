const PORTALE_REVISIONI = 'https://www.ilportaledellautomobilista.it/web/portale-automobilista/verifica-revisioni-effettuate-x2345nmnmll';
const ACI_INFOTARGA = 'https://www.aci.it/servizi/auto3d/';

function browserPlugin() {
  return window.Capacitor?.Plugins?.Browser || null;
}

export const verificationSources = {
  portale: {
    label: "Portale dell'Automobilista",
    url: PORTALE_REVISIONI,
    official: true,
  },
  aci: {
    label: 'ACI / Infotarga',
    url: ACI_INFOTARGA,
    official: true,
  },
  manuale: {
    label: 'Altro documento verificato',
    url: '',
    official: false,
  },
};

export function sourceLabel(key) {
  return verificationSources[key]?.label || 'Fonte verificata';
}

export async function openVerificationSource(key) {
  const source = verificationSources[key];
  if (!source?.url) throw new Error('Fonte non configurata.');

  const Browser = browserPlugin();
  if (Browser?.open) {
    await Browser.open({ url: source.url });
    return;
  }
  window.open(source.url, '_blank', 'noopener,noreferrer');
}

export function mileageComparison(currentKm, verifiedKm) {
  const current = Number(currentKm || 0);
  const verified = Number(verifiedKm || 0);
  if (!verified) return { state:'none', text:'Nessun chilometraggio verificato' };
  if (!current) return { state:'neutral', text:'Inserisci i km attuali per confrontarli' };

  const diff = current - verified;
  if (diff < 0) {
    return {
      state:'warning',
      text:`Attenzione: i km attuali sono ${Math.abs(diff).toLocaleString('it-IT')} km inferiori all’ultima revisione`,
    };
  }
  if (diff === 0) return { state:'ok', text:'Km attuali coerenti con l’ultima revisione' };
  return {
    state:'ok',
    text:`+${diff.toLocaleString('it-IT')} km dall’ultima revisione`,
  };
}
