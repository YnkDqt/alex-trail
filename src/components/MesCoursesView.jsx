import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { C, RUNNER_LEVELS, TERRAIN_TYPES, DEFAULT_EQUIPMENT, PREP_TIMELINE, EMPTY_SETTINGS, DEFAULT_FLAT_SPEED } from '../constants.js';
import { fmtTime, fmtPace, fmtHeure, isNight, calcNutrition, calcPassingTimes, exportRecap, exportGPXMontre, suggestSpeed, autoSegmentGPX, parseGarminCSV, buildElevationProfile, calcSlopeFromGPX, parseGPX } from '../utils.jsx';
import { Btn, Card, KPI, PageTitle, Field, Modal, ConfirmDialog, Empty, Hr, CustomTooltip } from '../atoms.jsx';

// ─── VUE MES COURSES ─────────────────────────────────────────────────────────
export default function MesCoursesView({ courses, onLoad, onDelete, onUpdate, onOverwrite, onSaveCurrent, race, segments, settings }) {
  const [confirmId, setConfirmId] = useState(null);
  const [confirmOverwriteId, setConfirmOverwriteId] = useState(null);
  const hasCurrentRace = race.gpxPoints?.length > 0 || segments.length > 0;

  return (
    <div className="anim">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <PageTitle sub={`${courses.length} stratégie${courses.length > 1 ? "s" : ""} sauvegardée${courses.length > 1 ? "s" : ""}`}>
          Mes courses
        </PageTitle>
        {hasCurrentRace && (
          <Btn onClick={onSaveCurrent} style={{ marginTop: 4, flexShrink: 0 }}>
            💾 Sauvegarder la course actuelle
          </Btn>
        )}
      </div>

      {courses.length === 0 ? (
        <Empty icon="📚" title="Aucune stratégie sauvegardée"
          sub={hasCurrentRace ? "Clique sur \"Sauvegarder la course actuelle\" pour l'ajouter ici." : "Prépare une course et sauvegarde-la ici pour la retrouver plus tard."}
          action={hasCurrentRace ? <Btn onClick={onSaveCurrent}>💾 Sauvegarder</Btn> : null}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {courses.map(c => {
            const date = new Date(c.savedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
            const time = new Date(c.savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            return (
              <Card key={c.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Nom + date */}
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-c)" }}>
                    {c.updatedAt
                      ? `Mis à jour le ${new Date(c.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à ${new Date(c.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                      : `Sauvegardée le ${date} à ${time}`
                    }
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Distance", value: c.distance ? `${c.distance.toFixed(1)} km` : "—" },
                    { label: "D+", value: c.elevPos ? `${Math.round(c.elevPos)} m` : "—" },
                    { label: "Segments", value: c.segCount || "—" },
                    { label: "Départ", value: c.startTime || "—" },
                    { label: "Temps estimé", value: c.totalTime ? fmtTime(c.totalTime) : "—" },
                    { label: "Ravitos", value: c.race?.ravitos?.length || 0 },
                  ].map(s => (
                    <div key={s.label} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted-c)", marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Commentaire */}
                <div>
                  <textarea
                    value={c.comment || ""}
                    onChange={e => onUpdate(c.id, { comment: e.target.value })}
                    placeholder="Commentaire : stratégie ambitieuse, V1, sans glucides..."
                    rows={2}
                    style={{ fontSize: 12, resize: "none", lineHeight: 1.5 }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <Btn onClick={() => onLoad(c)} style={{ flex: 1, justifyContent: "center" }}>
                    Charger
                  </Btn>
                  {hasCurrentRace && (
                    <Btn variant="soft" size="sm" onClick={() => setConfirmOverwriteId(c.id)} title="Écraser avec la version actuelle">
                      ↻
                    </Btn>
                  )}
                  <Btn variant="danger" size="sm" onClick={() => setConfirmId(c.id)}>✕</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmId}
        message="Supprimer cette stratégie définitivement ?"
        onConfirm={() => { onDelete(confirmId); setConfirmId(null); }}
        onCancel={() => setConfirmId(null)}
      />
      <ConfirmDialog
        open={!!confirmOverwriteId}
        message="Écraser cette stratégie avec la version en cours ? L'ancienne sera perdue."
        onConfirm={() => { onOverwrite(confirmOverwriteId); setConfirmOverwriteId(null); }}
        onCancel={() => setConfirmOverwriteId(null)}
      />
    </div>
  );
}
