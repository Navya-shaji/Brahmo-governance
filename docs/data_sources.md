# Data Sources — BRAHMO Governance Engine

This document records the clinical data sources used to design the seed knowledge nodes, protocols, and decision logic in the BRAHMO governance engine.

---

## 1. Sepsis Protocol (Nodes: N-M02, N-M08, N-DRV-01 through N-DRV-06)

**Source:** Surviving Sepsis Campaign (SSC) International Guidelines
- URL: https://www.sccm.org/SurvivingSepisCampaign/Guidelines
- Published by: Society of Critical Care Medicine (SCCM) & European Society of Intensive Care Medicine (ESICM)
- Key references used:
  - **Lactate measurement within 3 hours** — SSC 2021 Bundle recommendation
  - **Blood cultures before antibiotics** — SSC Hour-1 Bundle element
  - **30 mL/kg crystalloid for hypotension** — SSC fluid resuscitation guideline
  - **qSOFA scoring** (RR ≥ 22, SBP ≤ 100, altered mentation) — Sepsis-3 definition (Singer et al., JAMA 2016)
  - **Piperacillin-Tazobactam** as empiric antibiotic — standard hospital antibiogram-guided choice

**Sepsis v3 update (lactate within 1 hour)** based on:
- Updated SSC 2023 guidance tightening lactate measurement windows for early identification

---

## 2. DVT Prophylaxis Protocol — Orthopaedics (Nodes: N-O01, N-O02, N-O03)

**Source:** American Academy of Orthopaedic Surgeons (AAOS) Clinical Practice Guidelines
- URL: https://www.aaos.org/quality/quality-programs/lower-extremity-orthopedic-surgery/vte-prevention/
- Key references used:
  - **Enoxaparin 40mg SC daily** — standard low-molecular-weight heparin (LMWH) prophylaxis for surgical patients
  - **TKR (Total Knee Replacement): 14 days** — AAOS recommended minimum duration
  - **THR (Total Hip Replacement): 28 days** — AAOS recommended minimum duration
  - **Paracetamol first-line post-TKR** — multimodal analgesia protocol (NICE guideline NG193)
  - **Physiotherapy within 24 hours** — early mobilisation evidence base (Kehlet & Wilmore, 2008)

---

## 3. Diabetic Management Protocols (Nodes: N-M01, N-M03, N-M04)

**Source:** American Diabetes Association (ADA) Standards of Medical Care
- URL: https://diabetesjournals.org/care/issue/46/Supplement_1
- Key references used:
  - **Skip Glimepiride on fasting days** — ADA guideline on insulin management during procedural fasting
  - **Avoid sliding scale insulin alone** — ADA position statement against sole sliding-scale use (endorsed by AACE)
  - **HbA1c every 3 months** — ADA monitoring frequency recommendation for uncontrolled diabetes

---

## 4. Antibiotic Sensitivity Data (Node: N-EXP)

**Source:** WHO GLASS (Global Antimicrobial Resistance and Use Surveillance System)
- URL: https://www.who.int/glass
- Supplemented by: Indian Council of Medical Research (ICMR) AMR Surveillance Network
- URL: https://www.icmr.gov.in/
- Data used:
  - **E. coli sensitivity to Pip-Tazo: ~89%** — representative figure from regional hospital antibiogram studies
  - **K. pneumoniae sensitivity: ~72%** — consistent with South Asian AMR surveillance reports (2023-2024)
  - Marked as EXPIRED (valid_until: 2025-01-01) to reflect that antibiogram data must be refreshed annually

---

## 5. Hospital Hierarchy & Organisational Structure

**Source:** Fictional hospital "Supra Multi-Specialty Hospital" — organisational structure modelled on:
- NABH (National Accreditation Board for Hospitals & Healthcare Providers) hospital hierarchy standards
- URL: https://www.nabh.co/
- Hierarchy levels (Hospital → Clinical Division → Department → Ward) reflect standard Indian multi-specialty hospital org structures

---

## 6. Sepsis Mortality Statistics (Node: N-DRV-05)

**Source:** Indian Journal of Critical Care Medicine + WHO Sepsis Fact Sheet
- **18% in-hospital sepsis mortality** — consistent with published outcomes from Indian tertiary hospitals post-bundle implementation
- **National average 22%** — WHO Global Sepsis Alliance estimates for South Asia
- Reference: Nasa P et al., "Severe sepsis and its impact on outcome in India" — Indian Journal of Critical Care Medicine, 2012

---

## 7. ICU Capacity & Bed Reservation (Nodes: N-DRV-04, N-DRV-04-A, N-DRV-04-B)

**Source:** Fictional operational data modelled on:
- Average Indian tertiary hospital ICU bed-to-admission ratios
- Seasonal infection surge patterns (monsoon water-borne infections) documented in Indian public health literature
- Reference: Park's Textbook of Preventive and Social Medicine — monsoon disease burden chapter

---

## Notes

- All patient-facing data (names, IDs) are entirely fictional and do not represent real individuals
- Drug dosages are based on standard published guidelines but should not be used for actual clinical decision-making
- The BRAHMO system is a governance demonstration tool — it does not replace clinical judgment or hospital-specific protocols
