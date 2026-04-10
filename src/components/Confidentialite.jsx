import React from 'react';
import { C } from '../constants.js';

export default function Confidentialite({ setView }) {
  const s = {
    sec: { marginBottom: 32 },
    h2: { fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 500, color: C.inkLight, marginBottom: 12 },
    h3: { fontSize: 15, fontWeight: 600, color: C.inkLight, marginBottom: 8, marginTop: 16 },
    p: { fontSize: 13, lineHeight: 1.7, color: C.muted, marginBottom: 12 },
    ul: { fontSize: 13, lineHeight: 1.7, color: C.muted, paddingLeft: 20, marginBottom: 12 },
    em: { fontStyle: 'italic', color: C.inkLight },
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 500, color: C.inkLight, marginBottom: 8 }}>
          Politique de confidentialité
        </h1>
        <p style={{ fontSize: 13, color: C.muted }}>Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>1. Qui sommes-nous ?</h2>
        <p style={s.p}>
          Alex est une application web dédiée aux trail runners, développée par Yannick. 
          Elle vous accompagne dans la préparation de vos courses et le suivi de votre entraînement.
        </p>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>2. Quelles données collectons-nous ?</h2>
        <p style={s.p}>Pour fonctionner, Alex collecte et stocke les données suivantes :</p>
        <ul style={s.ul}>
          <li><span style={s.em}>Compte</span> : email, mot de passe (chiffré)</li>
          <li><span style={s.em}>Profil athlète</span> : prénom, sexe, date de naissance, taille, fréquence cardiaque (repos/max), zones FC, allures</li>
          <li><span style={s.em}>Activités</span> : distance, durée, dénivelé, fréquence cardiaque, zones d'effort, calories</li>
          <li><span style={s.em}>Forme</span> : VFC (variabilité fréquence cardiaque), sommeil, poids, mensurations</li>
          <li><span style={s.em}>Courses</span> : fichiers GPX, stratégies de course, ravitaillements, équipement</li>
          <li><span style={s.em}>Nutrition</span> : produits, recettes, journal alimentaire</li>
          <li><span style={s.em}>Programme</span> : séances planifiées, semaine type</li>
        </ul>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>3. Pourquoi collectons-nous ces données ?</h2>
        <p style={s.p}>Ces données sont strictement nécessaires au fonctionnement d'Alex :</p>
        <ul style={s.ul}>
          <li>Créer et gérer votre compte utilisateur</li>
          <li>Stocker et synchroniser vos données entre vos appareils</li>
          <li>Calculer vos zones d'entraînement et stratégies de course</li>
          <li>Analyser votre progression et votre forme</li>
          <li>Planifier votre nutrition et votre équipement</li>
        </ul>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>4. Où sont stockées vos données ?</h2>
        <p style={s.p}>
          Vos données sont hébergées chez <span style={s.em}>Supabase</span> (région UE — Paris), 
          un fournisseur certifié conforme au RGPD. Elles sont stockées dans une base PostgreSQL sécurisée 
          avec chiffrement au repos et en transit (TLS 1.3).
        </p>
        <p style={s.p}>
          <span style={s.em}>Accès</span> : seul vous avez accès à vos données via votre compte. 
          Nous ne les consultons, vendons ou partageons jamais avec des tiers.
        </p>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>5. Combien de temps conservons-nous vos données ?</h2>
        <p style={s.p}>
          Vos données sont conservées tant que votre compte est actif. 
          Si vous supprimez votre compte, toutes vos données sont définitivement effacées sous 30 jours maximum.
        </p>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>6. Vos droits (RGPD)</h2>
        <p style={s.p}>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul style={s.ul}>
          <li><span style={s.em}>Accès</span> : consulter vos données à tout moment depuis votre compte</li>
          <li><span style={s.em}>Portabilité</span> : exporter toutes vos données au format JSON (bouton "Exporter mes données")</li>
          <li><span style={s.em}>Rectification</span> : modifier vos données directement dans l'app</li>
          <li><span style={s.em}>Suppression</span> : supprimer définitivement votre compte et toutes vos données (bouton "Supprimer mon compte")</li>
        </ul>
        <p style={s.p}>
          Pour exercer ces droits ou pour toute question : <a href="mailto:alex-trailrunning@proton.me" style={{ color: C.forest }}>alex-trailrunning@proton.me</a>
        </p>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>7. Cookies et traceurs</h2>
        <p style={s.p}>
          Alex n'utilise <span style={s.em}>aucun cookie publicitaire ou traceur tiers</span>. 
          Seul un cookie de session technique (géré par Supabase) est utilisé pour maintenir votre connexion.
        </p>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>8. Sécurité</h2>
        <p style={s.p}>
          Nous mettons en œuvre les mesures de sécurité suivantes :
        </p>
        <ul style={s.ul}>
          <li>Mots de passe chiffrés (bcrypt)</li>
          <li>Connexion HTTPS (TLS 1.3)</li>
          <li>Row Level Security (RLS) : chaque utilisateur n'accède qu'à ses propres données</li>
          <li>Hébergement certifié RGPD (Supabase EU)</li>
        </ul>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>9. Modifications de cette politique</h2>
        <p style={s.p}>
          Nous pouvons modifier cette politique pour refléter des évolutions légales ou techniques. 
          Toute modification importante vous sera notifiée par email.
        </p>
      </div>

      <div style={s.sec}>
        <h2 style={s.h2}>10. Contact</h2>
        <p style={s.p}>
          Pour toute question concernant vos données personnelles :<br/>
          Email : <a href="mailto:alex-trailrunning@proton.me" style={{ color: C.forest }}>alex-trailrunning@proton.me</a>
        </p>
      </div>

      <div style={{ marginTop: 48, padding: "16px 20px", background: C.stone, borderRadius: 12, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
        <strong style={{ color: C.inkLight }}>📌 En résumé :</strong> Vos données sont à vous. 
        Nous les stockons de manière sécurisée (Supabase EU), vous pouvez les exporter ou supprimer à tout moment, 
        et nous ne les partageons jamais avec personne.
      </div>

      <button onClick={() => setView("donnees_params")}
        style={{ marginTop: 32, padding: "10px 18px", border: `1px solid ${C.border}`, background: C.white, 
          color: C.inkLight, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>
        ← Retour
      </button>
    </div>
  );
}
