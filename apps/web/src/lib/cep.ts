export interface CepAddress {
  zipCode: string;
  address: string;
  city: string;
  state: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export const normalizeCep = (value: string) => value.replace(/\D/g, '').slice(0, 8);

export const formatCep = (value: string) => {
  const digits = normalizeCep(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

export async function lookupCep(value: string): Promise<CepAddress> {
  const zipCode = normalizeCep(value);
  if (zipCode.length !== 8) {
    throw new Error('Informe um CEP com 8 dígitos');
  }

  const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
  if (!response.ok) {
    throw new Error('Não foi possível consultar o CEP');
  }

  const data = (await response.json()) as ViaCepResponse;
  if (data.erro || !data.localidade || !data.uf) {
    throw new Error('CEP não encontrado');
  }

  return {
    zipCode,
    address: [data.logradouro, data.bairro].filter(Boolean).join(', '),
    city: data.localidade,
    state: data.uf.toUpperCase(),
  };
}
