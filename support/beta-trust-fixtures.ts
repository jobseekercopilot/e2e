export interface ProfessionalContactFixture {
  phone: string;
  links: Array<{
    label: string;
    url: string;
  }>;
}

/**
 * Ofcom reserves 07700 900000-900999 for drama use. The .test domain is also
 * non-routable, so this fixture can never identify or contact a real person.
 */
export function syntheticProfessionalContact(): ProfessionalContactFixture {
  return {
    phone: '+44 7700 900555',
    links: [{
      label: 'Portfolio',
      url: 'https://portfolio.example.test/alex-taylor',
    }],
  };
}
