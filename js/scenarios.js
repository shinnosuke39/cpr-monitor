// シナリオ（外科実習Ⅱ 第2回 11/18 の症例1〜4）
// 2026-11-17 改訂：RECOVER 2024 に合わせ、最初の心電図評価は 2:00（最初の2分サイクルの終わり）。0:00〜2:00 は圧迫と換気だけ。
//   出典：Burkitt-Creedon ら 2024 RECOVER（JVECC 34(S1):104-123 §8.4 BLS-16）、Wolf ら ALS編（ALS-06・07・09・11・12・16）、授業 第9回ALS スライド
// シーンの項目：書いていない項目は今の値のまま。cmp=心臓マッサージ（true=中／false=止める）
// EtCO₂：圧迫の質ボタンで自動に動かすので、シーンで値を決めるのは co2Set のついた場面（倒れた・ROSC）だけ
window.CPR_SCENARIOS = [
  {
    id: 'c1', title: '症例1 心静止｜柴犬 10kg', patient: '柴犬 10kg',
    scenes: [
      { name: '倒れた（挿管済み）', rhythm: 'asystole', hr: 0, cmp: false, etco2: 0, co2Set: true, rr: 0, temp: 38.0, memo: '反応なし・呼吸なし→「CPA！」→すぐ圧迫・換気' },
      { name: 'CPR中（最初の2分）', cmp: true, rr: 10, temp: 38.0, memo: '圧迫・換気（10回/分）。電極・カプノはつけるが、心電図はまだ読まない' },
      { name: '評価・アドレナリン', rhythm: 'asystole', hr: 0, cmp: false, rr: 10, temp: 37.9, memo: '心静止・脈なし→圧迫再開・交代→アドレナリン 1.0mL（10倍希釈）→フラッシュ10mL' },
      { name: '評価・交代のみ', rhythm: 'asystole', hr: 0, cmp: false, rr: 10, temp: 37.9, memo: '心静止・脈なし→圧迫係を交代して再開。薬はなし' },
      { name: '自己心拍再開', rhythm: 'sinus', hr: 110, cmp: false, spo2: 94, etco2: 40, co2Set: true, rr: 10, bp: [100, 60], temp: 37.8, memo: 'EtCO₂が急に上がり35以上＋大腿動脈の拍動＝ROSC' }
    ],
    cues: [
      ['0:00', 0, '開始：反応なし・呼吸なし→「CPA！」'], ['', 1, '圧迫・換気を始めたら（2:00まで読まない）'],
      ['2:00', 2, '評価：心静止→アドレナリン①'], ['4:00', 3, '評価：交代のみ'],
      ['6:00', 2, '評価：心静止→アドレナリン②'], ['8:00', 3, '評価：交代のみ'],
      ['10:00', 4, 'ROSC：EtCO₂急上昇・拍動あり'], ['12:00', -1, '再開後の確認→「終了」']
    ]
  },
  {
    id: 'c2', title: '症例2 PEA｜猫 4kg', patient: '猫 4kg',
    scenes: [
      { name: '倒れた（挿管済み）', rhythm: 'pea', hr: 60, cmp: false, etco2: 0, co2Set: true, rr: 0, temp: 37.5, memo: '反応なし・呼吸なし→「CPA！」→すぐ圧迫・換気' },
      { name: 'CPR中（最初の2分）', cmp: true, rr: 10, temp: 37.5, memo: '圧迫・換気。心電図はまだ読まない' },
      { name: '評価・アドレナリン＋アトロピン', rhythm: 'pea', hr: 60, cmp: false, rr: 10, temp: 37.5, memo: '波形はあるが脈なし＝PEA→アドレナリン0.4mL＋アトロピン0.32mL（1回だけ）→フラッシュ3〜5mL' },
      { name: '評価・交代のみ', rhythm: 'pea', hr: 60, cmp: false, rr: 10, temp: 37.4, memo: 'PEA・脈なし→交代して再開。薬はなし' },
      { name: '評価・アドレナリン②', rhythm: 'pea', hr: 60, cmp: false, rr: 10, temp: 37.4, memo: 'PEA→アドレナリン0.4mL。アトロピンは繰り返さない' },
      { name: '自己心拍再開', rhythm: 'sinus', hr: 180, cmp: false, spo2: 93, etco2: 38, co2Set: true, rr: 10, bp: [110, 70], temp: 37.3, memo: 'EtCO₂急上昇＋拍動＝ROSC' }
    ],
    cues: [
      ['0:00', 0, '開始：反応なし・呼吸なし→「CPA！」'], ['', 1, '圧迫・換気を始めたら（2:00まで読まない）'],
      ['2:00', 2, '評価：PEA→アドレナリン①＋アトロピン'], ['4:00', 3, '評価：交代のみ'],
      ['6:00', 4, '評価：PEA→アドレナリン②'], ['8:00', 3, '評価：交代のみ'],
      ['10:00', 5, 'ROSC'], ['12:00', -1, '再開後の確認→「終了」']
    ]
  },
  {
    id: 'c3', title: '症例3 VF｜ラブラドール 30kg', patient: 'ラブラドール 30kg',
    scenes: [
      { name: '倒れた（挿管済み）', rhythm: 'vf', hr: 0, cmp: false, etco2: 0, co2Set: true, rr: 0, temp: 38.0, memo: '脈なし・呼吸なし→「CPA！」→すぐ圧迫・換気' },
      { name: 'CPR中（最初の2分）', cmp: true, rr: 10, temp: 38.0, memo: '圧迫・換気。心電図はまだ読まない' },
      { name: '評価・除細動 60J', rhythm: 'vf', hr: 0, cmp: false, rr: 10, temp: 38.0, memo: 'VF→充電中も圧迫→2J/kg＝60J→すぐ圧迫。薬なし' },
      { name: '評価・120J＋バソプレシン', rhythm: 'vf', hr: 0, cmp: false, rr: 10, temp: 37.9, memo: 'まだVF（除細動抵抗性）→4J/kg＝120J→圧迫→バソプレシン1.2mL→フラッシュ20mL' },
      { name: '評価・120Jのみ', rhythm: 'vf', hr: 0, cmp: false, rr: 10, temp: 37.9, memo: 'まだVF→120J→すぐ圧迫。薬なし' },
      { name: '自己心拍再開', rhythm: 'sinus', hr: 110, cmp: false, spo2: 94, etco2: 42, co2Set: true, rr: 10, bp: [100, 60], temp: 37.8, memo: 'EtCO₂急上昇＋拍動＝ROSC' }
    ],
    cues: [
      ['0:00', 0, '開始：反応なし・呼吸なし→「CPA！」'], ['', 1, '圧迫・換気を始めたら（2:00まで読まない）'],
      ['2:00', 2, '評価：VF→除細動60J'], ['4:00', 3, '評価：まだVF→120J＋バソプレシン①'],
      ['6:00', 4, '評価：まだVF→120Jのみ'], ['8:00', 3, '評価：まだVF→120J＋バソプレシン②'],
      ['10:00', 5, 'ROSC'], ['12:00', -1, '再開後の確認→「終了」']
    ]
  },
  {
    id: 'c4', title: '症例4【予備】無脈性VT｜ダックス 5kg', patient: 'ダックスフンド 5kg',
    scenes: [
      { name: '倒れた（挿管済み）', rhythm: 'vt', hr: 220, cmp: false, etco2: 0, co2Set: true, rr: 0, temp: 38.2, memo: 'HRは出ても脈はない→「CPA！」→すぐ圧迫・換気' },
      { name: 'CPR中（最初の2分）', cmp: true, rr: 10, temp: 38.2, memo: '圧迫・換気。心電図はまだ読まない' },
      { name: '評価・除細動 10J', rhythm: 'vt', hr: 220, cmp: false, rr: 10, temp: 38.2, memo: '無脈性VT＝除細動の適応→2J/kg＝10J→すぐ圧迫。薬なし' },
      { name: '評価・20J＋バソプレシン', rhythm: 'vt', hr: 220, cmp: false, rr: 10, temp: 38.1, memo: 'まだ無脈性VT→4J/kg＝20J→圧迫→バソプレシン0.2mL→フラッシュ10mL' },
      { name: '評価・20Jのみ', rhythm: 'vt', hr: 220, cmp: false, rr: 10, temp: 38.1, memo: 'まだ無脈性VT→20J→すぐ圧迫。薬なし' },
      { name: '自己心拍再開', rhythm: 'sinus', hr: 130, cmp: false, spo2: 94, etco2: 40, co2Set: true, rr: 10, bp: [110, 70], temp: 38.0, memo: 'EtCO₂急上昇＋拍動＝ROSC' }
    ],
    cues: [
      ['0:00', 0, '開始：反応なし・呼吸なし→「CPA！」'], ['', 1, '圧迫・換気を始めたら（2:00まで読まない）'],
      ['2:00', 2, '評価：無脈性VT→除細動10J'], ['4:00', 3, '評価：まだVT→20J＋バソプレシン①'],
      ['6:00', 4, '評価：まだVT→20Jのみ'], ['8:00', 3, '評価：まだVT→20J＋バソプレシン②'],
      ['10:00', 5, 'ROSC'], ['12:00', -1, '再開後の確認→「終了」']
    ]
  }
];
