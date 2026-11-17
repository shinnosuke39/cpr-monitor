// シナリオ（外科実習Ⅱ 第2回 11/18 の症例1〜4。OneDrive 救トレ_シナリオ表（症例1〜4）と同じ値）
// シーンの項目：書いていない項目は今の値のまま。cmp=心臓マッサージ（true=中／false=止める）
window.CPR_SCENARIOS = [
  {
    id: 'c1', title: '症例1 心静止｜柴犬 10kg', patient: '柴犬 10kg',
    scenes: [
      { name: '倒れた（挿管済み）', rhythm: 'asystole', hr: 0, cmp: false, etco2: 0, rr: 0, bp: null, temp: 38.0, memo: '反応なし・呼吸なし→「CPA！」' },
      { name: 'CPR中', cmp: true, etco2: 20, rr: 10, temp: 38.0, memo: 'EtCO₂ 18以上＝圧迫OK' },
      { name: '心電図・アドレナリン', rhythm: 'asystole', hr: 0, cmp: false, etco2: 18, rr: 10, temp: 38.0, memo: 'アドレナリン 1.0mL（10倍希釈）→フラッシュ10mL' },
      { name: '評価・交代（EtCO₂低め）', rhythm: 'asystole', hr: 0, cmp: false, etco2: 14, rr: 10, temp: 37.9, memo: '圧迫係を交代。下がったら圧迫の質を直す' },
      { name: '評価・アドレナリン', rhythm: 'asystole', hr: 0, cmp: false, etco2: 18, rr: 10, temp: 37.9, memo: 'アドレナリン 1.0mL' },
      { name: '自己心拍再開', rhythm: 'sinus', hr: 110, cmp: false, spo2: 94, etco2: 40, rr: 10, bp: [100, 60], temp: 37.8, memo: 'EtCO₂が急に10以上上がり35以上＋拍動＝ROSC' }
    ],
    cues: [
      ['0:00', 0, '開始：反応なし・呼吸なし→「CPA！」'], ['', 1, '圧迫・換気（10回/分）を始めたら'],
      ['0:30', 2, '心静止→アドレナリン①'], ['2:00', 3, '評価・圧迫係交代。EtCO₂ 14→圧迫の質'],
      ['4:00', 4, '評価→アドレナリン②'], ['6:00', 3, '評価・圧迫係交代'], ['8:00', 4, '評価→アドレナリン③'],
      ['10:00', 5, 'ROSC：EtCO₂急上昇・拍動あり'], ['12:00', -1, '再開後の確認→「終了」']
    ]
  },
  {
    id: 'c2', title: '症例2 PEA｜猫 4kg', patient: '猫 4kg',
    scenes: [
      { name: '倒れた（挿管済み）', rhythm: 'pea', hr: 60, cmp: false, etco2: 0, rr: 0, bp: null, temp: 37.5, memo: '波形はあるが脈なし' },
      { name: 'CPR中', cmp: true, etco2: 19, rr: 10, temp: 37.5, memo: 'EtCO₂ 18以上＝圧迫OK' },
      { name: '心電図・アドレナリン＋アトロピン', rhythm: 'pea', hr: 60, cmp: false, etco2: 18, rr: 10, temp: 37.5, memo: 'アドレナリン0.4mL＋アトロピン0.32mL→フラッシュ' },
      { name: '評価・交代（EtCO₂低め）', rhythm: 'pea', hr: 60, cmp: false, etco2: 15, rr: 10, temp: 37.4, memo: '圧迫係を交代。18未満＝圧迫の質を直す' },
      { name: '評価・アドレナリン', rhythm: 'pea', hr: 60, cmp: false, etco2: 18, rr: 10, temp: 37.4, memo: 'アドレナリン0.4mL。アトロピンは繰り返さない' },
      { name: '自己心拍再開', rhythm: 'sinus', hr: 180, cmp: false, spo2: 93, etco2: 38, rr: 10, bp: [110, 70], temp: 37.3, memo: 'EtCO₂急上昇＋拍動＝ROSC' }
    ],
    cues: [
      ['0:00', 0, '開始：反応なし・呼吸なし→「CPA！」'], ['', 1, '圧迫・換気を始めたら'],
      ['0:30', 2, 'PEA→アドレナリン①＋アトロピン'], ['2:00', 3, '評価・交代。EtCO₂ 15→圧迫の質'],
      ['4:00', 4, '評価→アドレナリン②'], ['6:00', 3, '評価・交代'], ['8:00', 4, '評価→アドレナリン③'],
      ['10:00', 5, 'ROSC'], ['12:00', -1, '再開後の確認→「終了」']
    ]
  },
  {
    id: 'c3', title: '症例3 VF｜ラブラドール 30kg', patient: 'ラブラドール 30kg',
    scenes: [
      { name: '倒れた（挿管済み）', rhythm: 'vf', hr: 0, cmp: false, etco2: 7, rr: 0, bp: null, temp: 38.0, memo: '脈なし・呼吸なし→「CPA！」' },
      { name: 'CPR中', cmp: true, etco2: 20, rr: 10, temp: 38.0, memo: '準備中も圧迫を止めない' },
      { name: 'VF・除細動1回目', rhythm: 'vf', hr: 0, cmp: false, etco2: 6, rr: 0, temp: 38.0, memo: '2J/kg＝60J を口で→すぐ圧迫' },
      { name: 'VF・除細動＋バソプレシン', rhythm: 'vf', hr: 0, cmp: false, etco2: 6, rr: 0, temp: 37.9, memo: '120J＋バソプレシン1.2mL' },
      { name: 'VF・除細動のみ', rhythm: 'vf', hr: 0, cmp: false, etco2: 6, rr: 0, temp: 37.9, memo: '120Jのみ' },
      { name: '自己心拍再開', rhythm: 'sinus', hr: 110, cmp: false, spo2: 94, etco2: 42, rr: 10, bp: [100, 60], temp: 37.8, memo: 'EtCO₂急上昇＋拍動＝ROSC' }
    ],
    cues: [
      ['0:00', 0, '開始：反応なし・呼吸なし→「CPA！」'], ['', 1, '圧迫・換気を始めたら'],
      ['0:30', 2, 'VF→除細動60J→すぐ圧迫'], ['2:00', 3, 'まだVF→120J＋バソプレシン①'],
      ['4:00', 4, 'まだVF→120J（薬なし）'], ['6:00', 3, 'まだVF→120J＋バソプレシン②'], ['8:00', 4, 'まだVF→120J（薬なし）'],
      ['10:00', 5, 'ROSC'], ['12:00', -1, '再開後の確認→「終了」']
    ]
  },
  {
    id: 'c4', title: '症例4【予備】無脈性VT｜ダックス 5kg', patient: 'ダックスフンド 5kg',
    scenes: [
      { name: '倒れた（挿管済み）', rhythm: 'vt', hr: 220, cmp: false, etco2: 8, rr: 0, bp: null, temp: 38.2, memo: 'HRは出ても脈はない' },
      { name: 'CPR中', cmp: true, etco2: 20, rr: 10, temp: 38.2, memo: '圧迫を止めずに除細動の判断' },
      { name: '無脈性VT・除細動1回目', rhythm: 'vt', hr: 220, cmp: false, etco2: 8, rr: 0, temp: 38.2, memo: '2J/kg＝10J→すぐ圧迫' },
      { name: '無脈性VT・除細動（＋薬）', rhythm: 'vt', hr: 220, cmp: false, etco2: 8, rr: 0, temp: 38.1, memo: '20J。2:00・6:00 バソプレシン0.2mL' },
      { name: '自己心拍再開', rhythm: 'sinus', hr: 130, cmp: false, spo2: 94, etco2: 40, rr: 10, bp: [110, 70], temp: 38.0, memo: 'EtCO₂急上昇＋拍動＝ROSC' }
    ],
    cues: [
      ['0:00', 0, '開始：反応なし・呼吸なし→「CPA！」'], ['', 1, '圧迫・換気を始めたら'],
      ['0:30', 2, '無脈性VT→除細動10J'], ['2:00', 3, '20J＋バソプレシン①'], ['4:00', 3, '20J（薬なし）'],
      ['6:00', 3, '20J＋バソプレシン②'], ['8:00', 3, '20J（薬なし）'], ['10:00', 4, 'ROSC'], ['12:00', -1, '再開後の確認→「終了」']
    ]
  }
];
