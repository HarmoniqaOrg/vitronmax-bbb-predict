import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PredictionResult from '@/components/dashboard/PredictionResult';
import { MoleculeResult } from '@/lib/types';

describe('PredictionResult Component', () => {
  const mockResultBase: MoleculeResult = {
    smiles: 'CCO',
    molecule_name: 'Ethanol',
    bbb_probability: 0.85,
    bbb_class: 'BBB+', // Changed from prediction_class
    prediction_certainty: 0.92, // Changed from confidence_score
    processing_time_ms: 120.5,
    mw: 46.07,
    logp: -0.31,
    tpsa: 20.23,
    h_donors: 1,
    h_acceptors: 1,
    rot_bonds: 0,
    pains_alerts: 0,
    brenk_alerts: 0,
    formal_charge: 0,
    molar_refractivity: 12.95,
    num_rings: 0,
    exact_mw: 46.04186,
    applicability_score: 0.75, 
    molecular_formula: 'C2H6O', // Added
    num_heavy_atoms: 3, // Added
    // Ensure all other relevant fields from MoleculeResult are present or intentionally omitted
    frac_csp3: 0.5, // Example value, ensure it's covered if displayed
    log_s_esol: -0.5, // Example value
    gi_absorption: 'High', // Example value
    lipinski_passes: true // Example value
  };

  it('should render all properties correctly when provided', () => {
    render(<PredictionResult result={mockResultBase} />);

    // Check existing properties
    expect(screen.getByText('Ethanol')).toBeInTheDocument();
    expect(screen.getByText('85.0%')).toBeInTheDocument(); // bbb_probability
    expect(screen.getAllByText('High Permeability')).toHaveLength(2);
    expect(screen.getByText('92.0%')).toBeInTheDocument(); // confidence_score
    expect(screen.getByText('120.50 ms')).toBeInTheDocument(); // processing_time_ms
    expect(screen.getByText('CCO')).toBeInTheDocument(); // smiles
    expect(screen.getByText('75.0%')).toBeInTheDocument(); // applicability_score

    // Check new physicochemical properties
    expect(screen.getByText('Molecular Weight')).toBeInTheDocument();
    expect(screen.getByText('46.07')).toBeInTheDocument();
    expect(screen.getByText('LogP')).toBeInTheDocument();
    expect(screen.getByText('-0.31')).toBeInTheDocument();
    expect(screen.getByText('TPSA')).toBeInTheDocument();
    expect(screen.getByText('20.23')).toBeInTheDocument();
    expect(screen.getByText('H-Bond Donors')).toBeInTheDocument();
    const hBondDonorsValue = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '1' &&
      element.previousElementSibling?.textContent === 'H-Bond Donors'
    );
    expect(hBondDonorsValue).toBeInTheDocument();

    expect(screen.getByText('H-Bond Acceptors')).toBeInTheDocument();
    const hBondAcceptorsValue = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '1' &&
      element.previousElementSibling?.textContent === 'H-Bond Acceptors'
    );
    expect(hBondAcceptorsValue).toBeInTheDocument();

    expect(screen.getByText('Rotatable Bonds')).toBeInTheDocument();
    const rotatableBondsValue = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '0' &&
      element.previousElementSibling?.textContent === 'Rotatable Bonds'
    );
    expect(rotatableBondsValue).toBeInTheDocument();

    expect(screen.getByText('Formal Charge')).toBeInTheDocument();
    const formalChargeValue = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '0' &&
      element.previousElementSibling?.textContent === 'Formal Charge'
    );
    expect(formalChargeValue).toBeInTheDocument();

    expect(screen.getByText('Molar Refractivity')).toBeInTheDocument();
    expect(screen.getByText('12.95')).toBeInTheDocument();
    expect(screen.getByText('Number of Rings')).toBeInTheDocument();
    const numRingsValue = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '0' &&
      element.previousElementSibling?.textContent === 'Number of Rings'
    );
    expect(numRingsValue).toBeInTheDocument();

    expect(screen.getByText('Exact MW')).toBeInTheDocument();
    expect(screen.getByText('46.04')).toBeInTheDocument(); // exact_mw (note: toFixed(2) in component)

    expect(screen.getByText('Molecular Formula')).toBeInTheDocument();
    expect(screen.getByText('C2H6O')).toBeInTheDocument();

    expect(screen.getByText('Heavy Atoms')).toBeInTheDocument();
    const heavyAtomsValue = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '3' &&
      element.previousElementSibling?.textContent === 'Heavy Atoms'
    );
    expect(heavyAtomsValue).toBeInTheDocument();

    expect(screen.getByText('Fraction CSP3')).toBeInTheDocument();
    expect(screen.getByText('0.50')).toBeInTheDocument(); // frac_csp3 (toFixed(2))

    expect(screen.getByText('ESOL LogS (Solubility)')).toBeInTheDocument();
    expect(screen.getByText('-0.50')).toBeInTheDocument(); // log_s_esol (toFixed(2))

    expect(screen.getByText('GI Absorption')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();

    expect(screen.getByText("Lipinski's Rule")).toBeInTheDocument();
    expect(screen.getByText('Passes')).toBeInTheDocument();

    // Check structural alerts (no highlighting in this case)
    expect(screen.getByText('PAINS Alerts')).toBeInTheDocument();
    const painsAlertValueNoHighlight = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '0' &&
      element.previousElementSibling?.textContent === 'PAINS Alerts'
    );
    expect(painsAlertValueNoHighlight).toBeInTheDocument();
    expect(painsAlertValueNoHighlight).not.toHaveClass('text-orange-600');
    expect(painsAlertValueNoHighlight).not.toHaveClass('font-semibold');

    expect(screen.getByText('Brenk Alerts')).toBeInTheDocument();
    const brenkAlertValueNoHighlight = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '0' &&
      element.previousElementSibling?.textContent === 'Brenk Alerts'
    );
    expect(brenkAlertValueNoHighlight).toBeInTheDocument();
    expect(brenkAlertValueNoHighlight).not.toHaveClass('text-orange-600');
    expect(brenkAlertValueNoHighlight).not.toHaveClass('font-semibold');
  });

  it('should highlight PAINS and Brenk alerts when their counts are greater than 0', () => {
    const mockResultWithAlerts: MoleculeResult = {
      ...mockResultBase,
      pains_alerts: 2,
      brenk_alerts: 1,
    };
    render(<PredictionResult result={mockResultWithAlerts} />);

    const painsAlertValue = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '2' && // Check for '2'
      element.previousElementSibling?.textContent === 'PAINS Alerts'
    );
    expect(painsAlertValue).toBeInTheDocument();
    expect(painsAlertValue).toHaveClass('text-orange-600', 'font-semibold');

    const brenkAlertValue = screen.getByText((content, element) =>
      element.tagName.toLowerCase() === 'p' &&
      content === '1' && // Check for '1'
      element.previousElementSibling?.textContent === 'Brenk Alerts'
    );
    expect(brenkAlertValue).toBeInTheDocument();
    expect(brenkAlertValue).toHaveClass('text-orange-600', 'font-semibold');
  });

  it('should display "Not specified" if molecule_name is not provided', () => {
    const mockResultNoName: MoleculeResult = {
      ...mockResultBase,
      molecule_name: undefined,
    };
    render(<PredictionResult result={mockResultNoName} />);
    // Check that the original name is not present
    expect(screen.queryByText('Ethanol')).not.toBeInTheDocument();
    // Check that 'Not specified' is present
    expect(screen.getByText('Not specified')).toBeInTheDocument();
  });
});
