import { fmtDate } from '../lib/api.js'
import { speciesLabel } from '../lib/species.js'

// Print-friendly medical record summary for one pet. Rendered inside a
// `.print-area` container (see index.css `@media print`) so the rest of the
// app chrome disappears when the user prints / saves as PDF.
export default function MedicalReportPrint({ pet, records = [], generatedAt }) {
  return (
    <div className="print-report rounded-2xl border border-sage-200 bg-white p-8 shadow-card">
      <div className="mb-6 border-b-2 border-charcoal-900 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-4">
            <img src="/pvlogo.png" alt="PetVibe Care logo" className="h-14 w-14 shrink-0 object-contain" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-charcoal-400">PetVibe Care · Veterinary Clinic</p>
              <h2 className="mt-1 text-2xl font-extrabold text-charcoal-900">Medical record summary — {pet.name}</h2>
              <p className="mt-0.5 text-sm text-charcoal-500">
                Owner: {pet.owner_name || '—'}
                {pet.owner_phone ? ` · ${pet.owner_phone}` : ''}
                {pet.owner_email ? ` · ${pet.owner_email}` : ''}
              </p>
            </div>
          </div>
          {generatedAt && <p className="text-xs text-charcoal-400">Generated {generatedAt}</p>}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        {[
          ['Species', speciesLabel(pet.species)],
          ['Breed', pet.breed || '—'],
          ['Weight', pet.weight_kg ? `${pet.weight_kg} kg` : '—'],
          ['Records on file', String(records.length)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-sage-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">{k}</p>
            <p className="mt-1 font-semibold text-charcoal-900">{v}</p>
          </div>
        ))}
      </div>

      {records.length === 0 ? (
        <p className="py-10 text-center text-charcoal-400">No medical records for this pet.</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {['Date', 'Type', 'Title', 'Notes', 'Attending staff', 'Next due'].map((h) => (
                <th key={h} className="border-b-2 border-charcoal-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-charcoal-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.record_id} className="border-b border-sage-100 align-top">
                <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(r.visit_date)}</td>
                <td className="px-3 py-2.5 capitalize">{r.type || '—'}</td>
                <td className="px-3 py-2.5 font-semibold">{r.title || '—'}</td>
                <td className="px-3 py-2.5">{r.treatment_notes || r.diagnosis || '—'}</td>
                <td className="px-3 py-2.5">{r.staff_name || '—'}</td>
                <td className="px-3 py-2.5">{r.next_due_date ? fmtDate(r.next_due_date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
