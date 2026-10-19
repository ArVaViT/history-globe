# Errors found in Theographic, OpenBible, Pleiades and Wikidata

Checked 2026-10-17. Sources, all downloaded the same night:

- Theographic Bible Metadata, `json/places.json` and `json/verses.json` from GitHub `robertrouse/theographic-bible-metadata`, branch master (CC BY-SA 4.0). Only their record ids and a few quoted field values appear here.
- OpenBible ancient records: `pipeline/.cache/openbible-ancient.jsonl` (fetched by `pnpm data`). Page URL pattern checked live: `https://www.openbible.info/geo/ancient/<id>` (HTTP 200).
- Pleiades: `pleiades-places-latest.csv.gz` dump, plus live `pleiades.stoa.org/places/<id>/json` for the ids named below.
- Wikidata: `wbgetentities` for all 647 QIDs used by us or by OpenBible, plus live re-checks for the items named below. English Wikipedia API (`prop=coordinates|extracts`) used where noted.
- Verse text: KJV, from the eBible KJV in `pipeline/.cache`.

Added 2026-10-19 (T14 to T22, O5, O6, the TIPNR section and items 4, 7, 9 to 11 of the last section), from the same kinds of sources: Theographic `json/places.json` (master, that day), the Pleiades dump of that day, live Wikidata, OpenBible's `ancient.jsonl` and `source.jsonl` from `pipeline/.cache` and GitHub, and STEPBible TIPNR commit b99716b (`pipeline/.cache/tipnr.txt`).

Added later on 2026-10-19 (O7, W7 to W9, the Pleiades and Wikidata "to check" items marked with that date, and items 13 to 15 of the last section): every settlement of ours compared with the point of its linked Pleiades record (`reprLat/reprLong` of the dump, `locationPrecision` "precise" only) and with its Wikidata item's P625 (`wbgetentities`, that day; a preferred-rank value over normal ones). Twenty settlements are more than 20 km from one of them; eight were already here (Zoan, Tegarama, Thapsacus and Tiphsah, Libnah, Tartessos, Aenon, Aroer, Sharuhen), the rest are below. The rivers and regions were skimmed only for links to the wrong record (Habor, Kidron).

Distances are haversine (great-circle) distances. Severity: **high** means the record points at the wrong place or the wrong country; **medium** means it misleads a map or a join; **low** is cosmetic or a completeness gap.
"Confirmed" means I opened the record and the evidence myself. Anything less certain is in "To check".

---

## Theographic: confirmed

### T1. Salmone (Acts 27:7) is placed at the Salmone in Elis, in the Peloponnese, not at the Cretan cape. Severity: high

- Record: `rec87ltw24GIvuFnT` (`salmone_1020`), `latitude` 37.69636, `longitude` 21.56999, `featureType` "City".
- Evidence: Acts 27:7 reads "...we sailed under Crete, over against Salmone." Their coordinate is exactly Pleiades 570652 "Salmone" (BAtlas 58 B2), a place in Elis (0.0 km). Their own `openBibleLat/openBibleLong` (35.2123, 26.2745, Cape Sideros on Crete) is 503 km away. OpenBible and we put it on Crete.
- What went wrong: the homonym was picked up in place of the cape.

### T2. Kidron (the brook at Jerusalem) has the coordinates of Gedros/Kedron near Yavne. Severity: high

- Record: `reccf5Vf48NjEXaxz` (`kidron_687`), lat 31.826142, lon 34.775865. Its verses include 2Sam.15.23, 1Kgs.15.13, 2Kgs.23.4, 2Kgs.23.6, 2Kgs.23.12, 2Chr.29.16 and Jer.31.40.
- Evidence: 2Sam.15.23 has David leaving Jerusalem: "the king also himself passed over the brook Kidron... toward the way of the wilderness." Their coordinate matches Pleiades 687905 "Gedros" (0.0 km), the coastal-plain Kedron of 1 Maccabees. It lies 44 km west of their own alias record `brook_kidron_688` (31.772134, 35.236596), which sits correctly at Jerusalem, and 44 km from the record's own `openBibleLat/Long`.

### T3. Gilgal (Joshua's camp "in the east border of Jericho") is placed in the Sharon plain. Severity: high

- Record: `recdm9AlLF01lFAfP` (`gilgal_476`), lat 32.1547, lon 34.95372. It carries 35 verses, including Josh.4.19, Josh.4.20, Josh.5.9 and Josh.5.10.
- Evidence: Josh.4.19 reads "...encamped in Gilgal, in the east border of Jericho." The coordinate is 56 km from their own Jericho (`jericho_634`, 31.870, 35.444). It sits 3 to 4 km from Pleiades 678223 Kapharsaba, near the Jaljulia that some identify with the Gilgal of Josh 12:23. Their `openBibleLat/Long` (31.8638, 35.5185) is correctly by Jericho.

### T4. Rimmon of the Negeb (Josh 15:32 and parallels) is placed in northern Lebanon. Severity: high

- Record: `recZuw7dAJ1x1EUfb` (`rimmon_1004`), lat 34.353071, lon 36.385705. Verses: Josh.15.32, Josh.19.7, 1Chr.4.32 and Zech.14.10.
- Evidence: Josh.15.21 introduces the list as "the uttermost cities of the tribe of the children of Judah toward the coast of Edom southward". Josh.15.32 then ends "...and Ain, and Rimmon." The coordinate is 4.5 km from Pleiades 668264 Hermel in the Lebanese Beqaa, and 375 km from their own Beersheba (`rectrAkGtrZH5LMp8`). The same value appears in their `openBibleLat/Long`, so it was probably inherited from the 2007 OpenBible data. Today's OpenBible puts Rimmon in the Negeb (31.383, 34.866).

### T5. Jezreel of Judah (Josh 15:56) is placed on Beth-shean. Severity: high

- Record: `recdU0shMzVelyTiU` (`jezreel_642`), lat 32.502074, lon 35.50196. Verses include Josh.15.56, 1Sam.25.43 and 2Sam.3.2.
- Evidence: Josh.15.56 ("And Jezreel, and Jokdeam, and Zanoah") belongs to the hill-country list of Judah (Josh 15:48 and following). The coordinate is 0.2 km from Pleiades 678378 Scythopolis/Nysa (Beth-shean) and 0.26 km from their own `beth-shan_232`. Their own `openBibleLat/Long` for this record (31.5358, 35.0941, south of Hebron) is 114 km away.

### T6. Jezreel in the north (Naboth's city) is also placed on Beth-shean. Severity: medium

- Record: `reczRCunsz83wZ1Q1` (`jezreel_643`, 22 verses, including 1Kgs.21.1 and 2Kgs.9.30), lat 32.502074, lon 35.50196. This is the same value as T5.
- Evidence: the record's own `openBibleLat/Long` (32.55596, 35.33079, Tel Jezreel) is 17 km away. The coordinate is 0.26 km from their Beth-shan.

### T7. Verses about the northern Jezreel are tagged to the Judahite Jezreel. Severity: medium

- Verses 1Sam.29.1 and 1Sam.29.11 are attached to `jezreel_642` (Judah) in both `places.verses` and `verses.places`.
- Evidence: 1Sam.29.1 reads "the Israelites pitched by a fountain which is in Jezreel". The setting is the Gilboa campaign: 1Sam.28.4 says "...the Philistines... pitched in Shunem: and Saul... pitched in Gilboa." That is the northern Jezreel, which they keep as `jezreel_643`.

### T8. Duplicate record for the northern Jezreel. Severity: low

- `recbCUdlemxNGIKfQ` (`jezreel_644`) holds only 2Sam.4.4 ("...when the tidings came of Saul and Jonathan out of Jezreel"). It is the same city as `jezreel_643`, with identical OpenBible coordinates to 8 decimals. The two records are not linked through `canonicalPlace`/`otherNames`, unlike their other alias pairs (Olivet/Mount of Olives, Elteke/Eltekeh).

### T9. Duplicate record: valley of Shaveh. Severity: low

- `recruGIaExz1GoMbG` (`valley_of_shaveh_692`: Gen.14.17, 2Sam.18.18) and `recZeNEbOWIqV0AmA` (`valley_of_shaveh_1216`: Gen.14.17). The same verse ("the valley of Shaveh, which is the king's dale") and the same coordinates appear in two unlinked records.

### T10. Place names in the KJV text with no place tag. Severity: medium

I checked every KJV verse whose `verseText` contains the name as a whole word. These verses have **no** link to that place in `verses.places`, and none appears in the place's `verses` list either:

- **Jerusalem** (`recL1WV82pXaRBQ59`), 13 of 767 verses: 2Chr.30.26, 2Chr.31.4, 2Chr.32.2, 2Chr.32.9, 2Chr.32.10, 2Chr.32.12, 2Chr.32.18, Jer.7.29, Jer.8.5, Luke.2.42, Luke.24.49, Acts.4.6 and Acts.18.21. The clearest case is 2Chr.32.9: it is tagged with Lachish and Assyria, while "Jerusalem" appears twice in the verse untagged. Luke.24.49 reads "tarry ye in the city of Jerusalem".
- **Asia** (`recpCMN0bRpzByjaR`): Acts.19.31, Acts.20.4 and Rev.1.11. Rev.1.11 is tagged with the seven cities but not with "the seven churches which are in Asia". Acts.20.4 carries only Derbe; Berea and Asia are missing.
- **Macedonia** (`recly2TmP9CBHh8OQ`): Acts.19.29 ("men of Macedonia") and 2Cor.9.4.
- **Galilee** (`recmL1lWBqWP3mAq3`): Matt.26.69 ("Jesus of Galilee"), Luke.23.6 ("When Pilate heard of Galilee") and Acts.5.37 ("Judas of Galilee").
- **Nazareth** (`recmRfnw4XzPBH9jc`): Mark.14.67 ("Jesus of Nazareth").
  (Matt.4.18 and similar "sea of Galilee" verses are tagged to the Sea of Galilee, which is correct and not counted. Hebron hits that refer to the person Hebron are not counted either.)

### T11. Records with a latitude and no longitude. Severity: low

`recAPCFiiSX6hmHhX` (azotus_132), `recU8S3zWJLQkEpwO` (chios_296), `recFrC0435yiaHYOu` (clauda_280), `recb5itcp169E9Vsj` (lasea_717) and `reco41jQa2HDPSWx2` (phrygia_946) have `latitude` set and `longitude` missing. Each still has `openBibleLong`. Anything that reads `latitude/longitude` drops these five places.

### T12. The Edom point sits next to Beersheba, west of the Arabah. Severity: medium

- `recLcxRZbz3yIQB7b` (edom_357): lat 31.25, lon 34.75, 8.6 km from their own Beersheba. Edom lies east of the Arabah (Num.20.16: "Kadesh, a city in the uttermost of thy border"). Their own `openBibleLat/Long` (30.7347, 35.6063) and their Bozrah are about 100 km away. A region point may be rough, but this one falls in another territory, Judah's Negeb.

### T13. The Bithynia point is in the Black Sea. Severity: low

- `rec5XS12X23Uadj5G` (bithynia_250): 42.5, 32.5. That is 84 km north of Amasra (41.746, 32.386), the nearest coast, so the point is open sea. Their `openBibleLat/Long` is 40.9055, 30.6858, on land.

### T14. The two Janoahs are swapped. Severity: high

- `recB4mpmdhIrF5Vhk` (`janoah_621`, Josh.16.6, Josh.16.7; `comment` "now Yanouh") is at 33.260246, 35.302915, which is Yanouh in Lebanon. `rec6NMdB9Jz6HdV8M` (`janoah_622`, 2Kgs.15.29) is at 32.155895, 35.361606, which is Khirbet Yanun in the hills of Ephraim.
- Evidence: Josh.16.6 is Ephraim's border: "...the border went about eastward unto Taanath-shiloh, and passed by it on the east to Janohah". 2Kgs.15.29 is Tiglath-pileser's campaign in the north: "...took Ijon, and Abel-beth-maachah, and Janoah, and Kedesh, and Hazor, and Gilead, and Galilee". Each record carries the other's site, 123 km away; the comment "now Yanouh" sits on the Ephraim record.

### T15. Hezron of Judah's southern border is placed at Hazor in Galilee. Severity: high

- `recfa19LQGbnLBD0G` (`hezron_568`, Josh.15.3): 33.017182, 35.56804857, which is Tel Hazor (Pleiades 779967430 "Tel Hazor", 33.0192, 35.5668, 0.3 km).
- Evidence: Josh.15.3 runs along the south of Judah: "...and ascended up on the south side unto Kadesh-barnea, and passed along to Hezron, and went up to Adar". OpenBible and we put it 285 km south, by Kadesh-barnea. Josh.15.25 gives the Negeb town as "Hezron, which is Hazor", and that homonym was picked up.

### T16. Zeboim of Nehemiah 11:34 is placed at the Dead Sea. Severity: medium

- `recKbrWvKRrBilVEG` (`zeboim_1245`, Neh.11.34): 31.1018224, 35.47633657, on the south-eastern shore of the Dead Sea, where the Zeboiim of Genesis 14 is sought (Numeira is 6 km away).
- Evidence: Neh.11.34 and 35 list Benjamin's towns in the coastal plain: "Hadid, Zeboim, Neballat, Lod, and Ono, the valley of craftsmen". OpenBible and we put it by Lod, 114 km away.

### T17. Erech is one degree of latitude north of Uruk. Severity: medium

- `recMrWeiaOEOsvqsw` (`erech_407`, Gen.10.10, Ezra.4.9; `comment` "now Uruk"): 32.322222, 45.636111.
- Evidence: Uruk is Pleiades 912986 "Uruk/Orchoe/Erech", 31.3222, 45.6361 (Wikidata Q168518 agrees). The longitude is the same to six decimals and the latitude is exactly 1.0 higher: a typo, 111 km.

### T18. Asshur, the city, is placed at Nineveh. Severity: medium

- `recAiXXgqL914wNA9` (`asshur_109`, Num.24.22, Num.24.24, Ezek.27.23, Ezek.32.22): 36.35941, 43.152887, which is Kuyunjik: Pleiades puts the Nineveh temples Emašmaš (763257295) and Ezida (287060405) within 0.1 km of it.
- Evidence: Pleiades 893945 "Ashur" (35.4567, 43.2625; Wikidata Q200200 agrees) is 101 km south. OpenBible and we are on it (0.2 km). Nineveh is their own `nineveh_880`.

### T19. Pelusium is placed in the Sinai interior, 259 km from Pelusium. Severity: medium

- `recIwC1OFvfA7JcTC` (`pelusium_929`, Ezek.30.15, Ezek.30.16) and `recJrTYgYd7ZHhwK1` (`sin_1097`, the same place under the KJV name): 28.838778, 33.420573, in the mountains of south-western Sinai (Pleiades 746834 "Wadi Mukkatab", a station, is 2 km away).
- Evidence: Pleiades 727192 "Pelusium" (31.0425, 32.5461; Wikidata Q1145715 within 5 km) is on the coast at the eastern edge of the Delta, where Ezek.30.15 ("I will pour my fury upon Sin, the strength of Egypt") and OpenBible put it; we agree within 0.1 km.

### T20. Punon is placed at Dhiban. Severity: medium

- `recwuZjxsXkzLUvxH` (`punon_961`, Num.33.42, Num.33.43): 31.49684513710609, 35.78284105296996, the point of Dhiban in Moab. Eleven other records share it to the last decimal: `oboth_906`, `iye-abarim_606`, `zalmonah_1238`, `almon-diblathaim_50`, `beth-diblathaim_199`, `madmen_750`, `dibon-gad_333`, `hamonah_521`, `valley_of_hamongog_1205`, `valley_of_the_passengers_1227` and `iyim_607`.
- Evidence: Punon is Khirbet Feinan in the Wadi Arabah, Wikidata Q2907858 (30.6278, 35.4936; we are on it to 0.0 km), 100 km south-west. Num.33.42 to 43 ("...pitched in Punon. And they departed from Punon, and pitched in Oboth") sits between Zalmonah and Oboth, south of the Arnon. Dibon-gad and Almon-diblathaim are near Dhiban; the rest are not.

### T21. Eleven towns of the Negeb and Simeon sit on one point in Gilead. Severity: high

- `recNerBj6ADOpYbfh` (`ezem_422`), `recexdp2klTSY2AmR` (`bethel_203`, the Bethel of 1Sam.30.27), `rec8l1lVhso3t7ULj` (`eltolad_380`), `recEqQREaXQbx8Uuf` (`baal_133`), `recGvmVzGXwM0gcuz` (`baalath-beer_138`), `recMycRUPsdlPW8ZK` (`bethuel_240`), `recQTK887MoYPCCId` (`bethul_241`), `recSSa66yHtBR12pu` (`chesil_289`), `recIwErv710ydIveN` (`iim_593`), `recevwD8aPKX3CoC6` (`ramoth_982`) and `recXH0UZI6yZKjxYj` (`tolad_1174`): all at 32.049953, 35.733402, which is beside es-Salt in Gilead (Pleiades 697665 "Gadara", the Gadara of Peraea, 3 km).
- Evidence: Josh.15.21 introduces their list as "the uttermost cities of the tribe of the children of Judah toward the coast of Edom southward"; Josh.19.8 calls Baalath-beer "Ramath of the south". The point is north of Jerusalem's latitude and east of the Jordan, 108 to 141 km from where OpenBible and we put each town. The `openBibleLat/Long` of every record is the same value, so the 2007 data had the cluster already.

### T22. Four wilderness stations are placed at Libnah in the Shephelah. Severity: medium

- `recFZ697FdVaWTxsm` (`libnah_729`, Num.33.20, Num.33.21), `recGNhuBDPlN7ZojH` (`rimmon-perez_1007`), `rec7mSP1c046zFefT` (`rithmah_1009`) and `recenS6TzJXjD2Nkc` (`laban_710`, Deut.1.1): 31.8099, 34.9365, a point in the Shephelah they share with the Judahite towns `ashan_100`, `ashnah_105`, `ether_418`, `iphtah_598`, `tochen_1173` and `bor-ashan_253`.
- Evidence: Num.33.18 to 21 are stations between Hazeroth and Kadesh: "...pitched in Rithmah... Rimmon-parez... Libnah... Rissah". Deut.1.1 names Laban "in the wilderness, in the plain over against the Red sea". The same mistake as Wikidata's W4 (the city Libnah's item used for the camp), extended to the neighbouring stations, 200 to 320 km from OpenBible's points. Thirteen more stations (Bene-jaakan, Haradah, Hashmonah, Kehelathah, Makheloth, Mithkah, Moseroth, Mount Shapher, Rissah, Tahath, Terah, Beeroth Bene-jaakan and the mountain `mount_shapher_854`) share one point near Petra (30.317396, 35.407152); their sites are unknown, so that is a placeholder, not an error.

## Theographic: to check

- **Jotbah** (`recgcRR8lIX8T7Tr7`, 2Kgs.21.19) is at 29.758, 35.031, which is the Jotbathah/Taba area near Eilat. OpenBible and we put it at Yodfat in Galilee, 343 km away. The Galilee identification is the majority view, but older literature did equate Jotbah with Jotbathah. Not an outright error.
- **Hosah** (`recSPzi0p68v5OEah`, Josh.19.29): 32.178502, 35.22758, in the hills of Samaria (Pleiades 678244 "Khirbet et Tira", 3 km). Josh.19.29 ties it to Tyre: "...the strong city Tyre; and the coast turneth to Hosah". OpenBible and we are 118 km north, south of Tyre. The exact site is not settled, so this stays here, but Samaria cannot be right.
- **Hadrach** (`recmvSKuAxrUd95O2`, Zech.9.1): 33.519299, 36.31345, at Damascus (Pleiades 678106, 0.9 km). The Zakkur stele's Hatarikka is Tell Afis (Pleiades 725486993), 269 km north, where we are (0.1 km). Damascus is named separately in the same verse ("Hadrach, and Damascus shall be the rest thereof").
- **Telassar** (`reckMtGITvZc8u1bI`, 2Kgs.19.12, Isa.37.12; `comment` "from http://en.wikipedia.org/wiki/Elam"): 32.189, 48.258, which is Susa (Pleiades 912936, 0.4 km). 2Kgs.19.12 has "the children of Eden which were in Thelasar", that is Bit-Adini on the Euphrates; proposals are Til-Barsip or Til-Bashir, where OpenBible and we are (1058 km from Susa). Not a settled site, but Elam is a different country.
- **Tamar** (`recGwBS5vf8v2OCVU`, 1Kgs.9.18): 34.554, 38.266, which is Palmyra. That follows the Qere "Tadmor" (so KJV); the Kethib "Tamar" is the Tamar of the Arabah (Pleiades 688039 "Thamara?", where we are, 1 km). A reading, not an error.
- **Beth-togarmah** (`recs2AAjd7vMgu9gf`, Ezek.27.14, Ezek.38.6): 40.066, 45.036, in Armenia. Tegarama is usually sought at Gürün (OpenBible and we, 683 km away); Armenia follows the older identification with the Armenians' eponym. A choice, not an error.
- **The Dhiban cluster** (T20): `oboth_906` (Num.21.10, Num.33.43), `iye-abarim_606`, `zalmonah_1238`, `madmen_750`, `hamonah_521` and the two valleys of Ezekiel 39 sit on Dhiban. Their sites are unknown; Oboth and Iye-abarim are "in the wilderness which is before Moab, toward the sunrising" (Num.21.11), which Dhiban is not.
- **Karkor** (`karkor_669`, Judg.8.10): their point is in Gilead, 196 km from Qarqar in the Wadi Sirhan, where OpenBible and we put it. Both are proposals.

---

## OpenBible: confirmed

### O1. Cnidus (Acts 27:7) links to the Pleiades Knidos on Cyprus. Severity: high

- Record: https://www.openbible.info/geo/ancient/ab793ce, `linked_data.s2428ed.id` = `707539`.
- Evidence: Pleiades 707539 "Knidos" is described as "an ancient city of Cyprus located on the Elaea promontory in northeastern Cyprus" (35.329, 34.055). That is 619 km from OpenBible's own Cnidus coordinate (36.686, 27.375, Tekir in Caria). The Carian city is Pleiades 599575 "Cnidus (Tekir)".

### O2. Madmenah (Isa 10:31) links to the Wikidata item for Madmannah (Josh 15:31). Severity: medium

- Record: https://www.openbible.info/geo/ancient/a67297a, `s7cc8b2` = `Q6728293`. That item's label is "Madmannah", its enwiki page is "Menois", and its P1584 is 687964 "Maon/Menoeis".
- Evidence: Isa.10.31 ("Madmenah is removed; the inhabitants of Gebim gather themselves to flee") falls in the Assyrian approach list north of Jerusalem, next to Anathoth and Nob. Josh.15.31 ("And Ziklag, and Madmannah, and Sansannah") is in the Negeb. The Pleiades place linked through that QID is 95 km from OpenBible's own Madmenah point (31.820, 35.223).

### O3. Wikidata links that point to disambiguation pages. Severity: medium

Each item below has P31 = Q4167410 ("Wikimedia disambiguation page"), checked live:

- `ad4ad26` Alemeth → Q4716077
- `ad68510` Eshtemoa → Q5397937
- `a9ef72b` Peor → Q61862532
- `ad27541` Ramah (Ramah 5, 2Kgs.8.29) → Q412380
- `af0ac29` Elath → Q3721153, which now redirects to Q1303899, the "Eilat (disambiguation)" page

### O4. Wikidata links that are now redirects. Severity: low

These QIDs resolve, but only through a redirect, so joins on the raw id miss them. Old → current:
Achzib `a2270e4` Q54991090→Q1323297; Allammelech `a84cafa` Q28220401→Q6573228; Azal `ad041dd` Q4832126→Q7217851; Beth-anath `ae6cef8` Q60790206→Q25492503; Daberath `a6a5e97` Q5207462→Q20502682; Elath `af0ac29` Q3721153→Q1303899; Ephraim `aa24ad4` Q27627879→Q18500022; Gabbatha `aec23b1` Q1488020→Q591994; Gadara `afed46a` Q96379011→Q56322109; Gibbethon `a6f048c` Q25493256→Q11298139; Kartah `ac0f6e7` Q6373489→Q117704182; Kir `ab92800` Q65086594→Q1742404; Pekod `a4b9865` Q48968605→Q11944059; Sychar `a27b472` Q12971071→Q1651088.

### O5. The TIPNR links name a 2021 TIPNR; 133 of 1172 no longer resolve, 8 point at the wrong record. Severity: medium

- Source `s3b25cf` (their `source.jsonl`: "Translators Individualised Proper Names with all References", year 2021, https://github.com/tyndale/STEPBible-Data). Every link has the form `Name@FirstVerse`; none carries the `-LastBook` suffix TIPNR puts on a place named in more than one book (`Abdon@Jos.19.28-1Ch`), so a join on the raw id finds 388 of the 1172 today.
- Checked against TIPNR commit b99716b, by name and verse (scripts/tipnr-links.ts; the method and the hand-checked cases are in its comments). 1039 links are the current unique name or that name without the suffix. 132 name a record TIPNR has since changed: 77 whose first verse moved (`Abdon@Jos.21.30` → `Abdon@Jos.19.28-1Ch`, `Jerusalem@Jos.10.1` → `Jerusalem@Gen.14.18-Rev`, `Baalath-beer@Jos.19.8` → `Baalath-beer@Jos.15.24-1Ch`), 29 renamed (`Javan@Isa.66.19` → `Greece@Isa.66.19-Act`, `Sardis@Oba.1.20` → `Sepharad@Oba.1.20-Rev`, `Cana@Jos.19.28` → `Kanah@Jos.19.28-Jhn`, `Bethany@Jdg.7.24` → `Beth-barah@Jdg.7.24-Jhn`, `Avva@2Ki.17.24` → `Ivvah@2Ki.17.24-Isa`, `Cuth@2Ki.17.30` → `Cuthah@2Ki.17.24-`), 15 merged into another record as an alias form (`Bethul@Jos.19.4` and `Bethuel@1Ch.4.30` → `Bethel@Jos.19.4-1Ch`, `El-bethel@Gen.35.7` → `Bethel@Gen.12.8-Zec`, `Abel-shittim@Num.33.49` → `Shittim@Num.25.1-Mic`, `Ham@1Ch.4.40` → `Egypt@Gen.12.10-Rev`), and 11 followed by hand (below). One is gone: `Beyond_the_River@Ezr.4.10` (`a88310a`) is no longer a TIPNR record.
- Links to the wrong record, confirmed by the verses:
  - `ab92800` Kir 1 (2Kgs.16.9, Isa.22.6, Amos.1.5, Amos.9.7, the Kir of Assyria) → `Kir@1Sa.22.3`, which is Kir of Moab (TIPNR's "Kir of Moab"; its verses are 1Sam.22.3, 2Kgs.3.25, Isa.15.1...). TIPNR's `Kir@2Ki.16.9-Amo` carries all four of the record's verses.
  - `aeb5f24` Bethel 2 (1Sam.30.27, the Negeb) → `Bethel@Jos.12.16`, the Bethel of Jacob. TIPNR's `Bethel@Jos.19.4-1Ch` ("Bethel_2") has 1Sam.30.27.
  - `a8da370` Rimmon 2 (Josh.15.32, Josh.19.7, 1Chr.4.32, Zech.14.10) → `Ain@Num.34.11`, the Ain of the northern border, to which TIPNR gives Zech.14.10 alone; `Rimmon@Jos.15.32-1Ch` has the other three verses.
  - `a7a5f29` Ham 1 (Gen.14.5) → `Ammon@Deu.2.19`, the nation; TIPNR has the town, `Ham@Gen.14.5`.
  - `ae67841` Perez-uzzah → `Uzzah@2Sa.6.3`, a person record; the place is `Perez-uzza@1Ch.13.11`.
  - `a3a2a75` Dedan, `a2735ff` Edom and `a831506` Teman (places) → `Dedan@Gen.10.7`, `Esau@Gen.36.40` and `Teman@Gen.36.34`, which are person records (the eponyms); TIPNR's `Dedan@Isa.21.13-Ezk`, `Edom@Gen.32.3-Mal` and `Teman@Jer.49.7-Hab` carry the records' verses.
- Our `tipnr` ids (api/v1/places.json, docs/crosswalk/places.csv) are the current names; OpenBible's link is kept beside them as `openbible_tipnr`.

### O6. "Another name for" is resolved one hop, so a place and its other name land on different sites. Severity: medium, high for Dimonah

- 1003 identifications say a record is another ancient record ("another name for", "within N km of"); for 499 records that is the top identification. OpenBible gives such a record the coordinates of the other record's best _modern_ candidate, one hop, and not the other record's own point. When the other record's own top identification is itself an ancient record, or the two records name each other (seven mutual pairs: Baalah 1 and Bilhah, Baalath-beer and Bealoth 1, Beer 1 and Beer-elim, Cabbon and Machbenah, Dibon 2 and Dimonah, Elon and Elonbeth-hanan, Enaim and Enam), the two end on different sites. Seventeen records whose top identification is "another name for X" are more than 1 km from X; checked one by one:
  - `ac17675` Dimonah (Josh.15.22) → "another name for Dibon 2" (`a3d1c99`, Neh.11.25), which in turn is "another name for Dimonah"; Dimonah resolves through Dibon 2's second identification, "another name for Dibon 1", to Tall Dhiban in Moab (31.5022, 35.7766). Dibon 2 resolves to Khirbet edh-Dheiba (31.2961, 35.1562), 63 km away. Josh.15.21 to 22 is the Negeb list: "...toward the coast of Edom southward were Kabzeel, and Eder, and Jagur, and Kinah, and Dimonah". **High**: a Negeb town shown in Moab. We put Dimonah on Dibon 2's point (content/place-points.json).
  - `a92de65` Bethul (Josh.19.4) and `acf2fac` Chesil (Josh.15.30) → "another name for Bethuel" (`a55cec0`): resolved to Khirbet ar Ras (31.3273, 34.8785), Bethuel's second candidate, while Bethuel itself is "another name for Bethel 2" and sits at Khirbet el-Qaryatein (31.3450, 35.1244), 23 km east. Moved to Bethuel's point.
  - `ae83efa` Canneh (Ezek.27.23) → "another name for Calneh 2" (`a7be664`): Kullan Köy, 74 km from Calneh 2's own Tell Tayinat. Moved.
  - `ad259d1` Sea of Jazer → Jazer (`a095b6e`), 11 km; `a6c0a5f` Ir-moab → Ar (`a38ad07`), 9 km; `a5c4318` Hukok → Helkath (`a1d1918`), 8 km. Moved to the named record's point.
  - `a061538` Zer (Josh.19.35) → "another name for Madon" (`a6c2936`): resolved to Qarn Hattin (32.7997, 35.4597), while Madon is itself "another name for Merom" and sits on Merom's point, Tell el Khirbeh (33.0768, 35.4324), 31 km north in Upper Galilee. Josh.19.35 lists Zer with Ziddim, Hammath, Rakkath and Chinnereth, the towns by the Sea of Galilee, and Ziddim is sought at Hattin, under Qarn Hattin. Left on Qarn Hattin (moved and taken back on review, 2026-10-19).
  - `ab049cf` Ramoth 2 (1Sam.30.27, Ramoth of the Negeb) → "another name for Ramah 6" (`aaa4c6e`, Josh.19.8): resolved to Horbat Uza (31.2092, 35.1657), while Ramah 6 is itself "another name for Baalath-beer" and sits on Baalath-beer's point, Beer Yeroham (30.9910, 34.9113), 34 km south-west. Ramat-negeb of Arad ostracon 24 is sought at Horbat Uza or Tel Ira, by Arad; Beer Yeroham is where OpenBible resolves Baalath-beer. Left on Horbat Uza (moved and taken back on review, 2026-10-19); Ramah 6 and Baalath-beer are item 12 below.
  - `a702ab6` Sea of Egypt → Red Sea 1 (`a3d18b2`): Bitter Lakes against the Gulf of Suez, 187 km. Both are water bodies with arbitrary points; left as it is.
  - The mutual pairs with two points: Cabbon and Machbenah (23 km), Elon and Elonbeth-hanan (11 km), Enaim and Enam (5 km). Each is "another name for" the other and each sits on the other's second-best candidate; neither record is canonical, so we left both (OpenBible: to check).
- "Within": `a86d49f` Shaveh-kiriathaim is "within 1 km of Kiriathaim 1" and resolves 24 km from Kiriathaim 1's own point (Kiriathaim's third candidate); `a991067` Mount Perazim is "within 250 m of Baal-perazim" and 5 km from it. Not changed.

### O7. Two Wikidata links name an item that is not the place. Severity: medium

- `a6fc60d` Aphek 3 (1Kgs.20.26, 1Kgs.20.30, 2Kgs.13.17, the Aphek of Aram; OpenBible resolves it to Tel Ein Gev, 32.7837, 35.6373) → `Q4779536`. That item's English article is "Aphek (biblical)", which opens "The name Aphek or Aphec refers to one of several locations", and its P625 (32.0833, 34.8833) is the Aphek of the Sharon, 105 km away, which OpenBible links separately as `a7b2e63` → `Q682612` Antipatris. The other Apheks have items of their own (`ac4f712` → `Q4779601`, `a4cf129` → `Q383537`); this one carries the article for the name.
- `adb5ae4` Kedesh 3 (1Chr.6.72, the Levitical town of Issachar; OpenBible's top identification is "another name for Kishion", `a20364a`, Josh.21.28 in the parallel list, at Tel Qishyon, 32.6614, 35.3931) → `Q6601333` "Tell Abu Qedeis", described as "mountain in Israel" (P31 tell, mountain; no Wikipedia article), at 32.5595, 35.2160: OpenBible's own second candidate, 20 km away. The link is to a modern tell, the kind OpenBible marks "modern" elsewhere, and to the runner-up identification rather than the one it resolves.

## OpenBible: to check

- The mutual pairs of O6 with two sites: Cabbon `a7ed00e` and Machbenah `a3b7885`; Elon `ae180d8` and Elonbeth-hanan `a8e6824`; Enaim `a59fdf2` and Enam `a26921e`. The data says "the same place" and gives two points; which point, if either, is a question for the identification, not the resolver.
- The 1039 TIPNR links that resolve are OpenBible's choice of record; our own verse-based match (`pipeline/.cache/people/tipnr-places-match.json`) agrees with every one of them where it is confident.

---

## STEPBible TIPNR: to check

- The map links in TIPNR's place records ("based on geoposition as defined by OpenBible", its header) carry the OpenBible coordinates of the time. Against today's OpenBible points, 212 of our 718 settlements with a TIPNR point are more than 20 km away: the referents OpenBible has since split (`Babylon@Gen.10.10-Rev` for the Babylon of 1 Pet 5:13, which OpenBible puts at Rome), re-identifications (Telassar, Calneh, Sepharvaim, Beth-togarmah) and some odd points (`Ham@Gen.14.5` is at 30.108, 31.338, in the Nile Delta, 502 km from OpenBible's Tel Ham). TIPNR's coordinates are not used by us; its ids are.

---

## Wikidata: confirmed

### W1. Antipatris (Q682612) has P1584 = "68799", which does not exist; the correct id is 687996. Severity: medium

- https://pleiades.stoa.org/places/68799/json returns HTTP 404, and 68799 is not in the Pleiades dump. https://pleiades.stoa.org/places/687996 is "Pegai/Antipatris/Arethousa?" at 32.1052, 34.9310, which matches the Wikidata P625 (32.105, 34.9304) to within 0.06 km. The value looks like 687996 with its last digit dropped.

### W2. Zoan (Q8073157) has P625 in Brazil. Severity: high

- P625 = −7.1215981, −34.882028, around João Pessoa, Brazil. The English Wikipedia article for the same item says Zoan "was a city of Egypt in the eastern Nile Delta" and equates it with Tanis. Tanis on Wikipedia is 30.977, 31.88. OpenBible, Pleiades 727236 (Tanis) and we all agree within 0.3 km. The error is 8,253 km.

### W3. Tegarama (Q12400954) P625 is 377 km from Gürün. Severity: high

- P625 = 39.801, 41.429, in Erzurum province. The English Wikipedia article for the item says Tegarama "is often identified with Gürün". Pleiades 628982 "Gauraina" (Gürün; alias Til-garimmu) is at 38.723, 37.257, and OpenBible's point is 2 km from it. Wikidata is 379 km from Pleiades.

### W4. Libnah (Q3486583) P625 is in Sinai, while the item's own Wikipedia article puts the city in the Shephelah. Severity: medium

- P625 = 29.9167, 34.6667, in the Sinai desert, which could only be the wilderness camp of Num 33:20. The enwiki article for this item has coordinates 31.63, 34.873, matching OpenBible's Libnah (31.6299, 34.8735). The distance is 192 km. The item is used for the city (Josh.10.29 etc.).

### W5. Aroer on the Arnon (Q4795478) P625 is at the mouth of the Arnon, 24 km from the site. Severity: low

- P625 = 31.4672, 35.5633 (the same value as enwiki), on the Dead Sea shore. Pleiades 697635 "Aroes" (31.4715, 35.8219) and OpenBible (31.4708, 35.8194, Khirbet 'Ara'ir) agree within 0.3 km. Deut 2:36 places Aroer "by the brink of the river of Arnon", and the tell is up on the gorge, not at the mouth.

### W6. Knidos (Q690575): P1584 points to the earlier site at Burgaz, while P625 is at Tekir. Severity: low

- P625 = 36.6858, 27.375 (Tekir). P1584 = 599576 "Cnidus (Burgaz)" at 36.7356, 27.6994, 29 km away. Pleiades 599575 "Cnidus (Tekir)" matches the item's coordinates, and Pleiades says the centre moved to Tekir in the later 4th century BCE. The coordinate and the Pleiades link describe two different sites. The item should carry 599575, possibly in addition to 599576.

### W7. Kidron Valley (Q860532) has P1584 = 687905, which is Gedros near Yavne. Severity: high

- The item's own P625 is 31.7770, 35.2390, east of the Old City of Jerusalem. Pleiades 687905 "Gedros" (BAtlas 70 F2) is a settlement in the coastal plain at 31.8261, 34.7759, 44 km west: the Kedron of 1 Maccabees 15:39. The dump has no record for the Kidron at all (titles and descriptions searched for Kidron, Kedron and Cedron: only the Silwan necropolis and Mar Saba mention the valley).
- The same coordinate is Theographic's Kidron (T2), and it was our Pleiades link too (item 13 below): both look like this P1584 followed blindly.

### W8. Khabur River (Q685344) has P1584 = 874565, the Lesser Khabur of Kurdistan. Severity: high

- The item's P625 is 35.1425, 40.4308, where the Khabur joins the Euphrates at Circesium, and its description is "river in Syria and Turkey". Pleiades 874565 "Lesser Khabur R." (BAtlas 89 E3) is a tributary of the Tigris in northern Iraq (37.2037, 42.9212, 321 km away), attested by Pleiades only from 1700. The Khabur of Syria is Pleiades 893928 "Aborras/Chaboras (river)" (BAtlas 91 B2, 36.3439, 40.3871).

### W9. Golan (Q2400848) P625 is 32 km from where its own article puts the town. Severity: medium

- P625 = 32.9479, 35.6612 (two statements with the same value), on the western edge of the Golan above the Jordan. The item's English article says "most researchers localize it at Sahm el-Jaulān in Syria's Daraa Governorate"; Sahm el-Jaulan is 32.7811, 35.9347, where OpenBible and we are (OpenBible's one identification, 29 votes).

## Wikidata: to check

- **Aenon (Q5977371)**: 31.8375, 35.5494, near Bethany beyond the Jordan. OpenBible and Pleiades 678003 put it near Salim, 61 km north. The location is genuinely disputed (the Madaba map supports the southern site), so this is not an error.
- **Thapsacus (Q1284954)**: 35.156, 40.428. OpenBible has 35.95, 38.17, 223 km away. Pleiades 674270 marks the place as "unlocated" with a rough point. The location is unknown.
- **Sharuhen (Q1548392)**: its preferred P625 is Tell el-Far'ah (South), which is one of three candidate identifications. It is 22 km from the OpenBible/Pleiades point. Disputed, not an error.
- **Jotbathah (Q15229779)**, 2026-10-19: P625 29.8956, 35.06, the Yotvata oasis ('Ain Ghadian). OpenBible and we are at Taba by Eilat (29.4925, 34.8969), 47 km south; OpenBible's votes are 12 for Taba and 5 for Ein Yotvata. Deut 10:7 ("Jotbath, a land of rivers of waters") is claimed for both. Disputed, not an error.
- **Achshaph (Q4157407)**, 2026-10-19: P625 32.9518, 35.1738, in the plain north of Acre. OpenBible and we are at Tel Regev (32.7589, 35.0903), 23 km south; Tell Keisan is OpenBible's close runner-up (20 votes to 18). Disputed.
- **Zaretan (Q147911)**, 2026-10-19: P625 32.0958, 35.4614, west of the Jordan. The article itself names Glueck's Tell es-Sa'idiyeh, where OpenBible and we are (32.2677, 35.5772, 22 km), and Tell el-Mazar as the newer proposal. Disputed.
- **Huqoq (Q18608506)**, 2026-10-19: the item is the Roman-period village at Yaquq (32.8847, 35.4789), which its article identifies with Hukkok of Josh.19.34. OpenBible and we are at Khirbet el-Jemeijimeh (32.8643, 35.2634), 20 km west, OpenBible's top candidate by trend (Yaquq has more votes in all, 202 to 174). Not an error of theirs; our record contradicts itself (item 15).
- **Etham (Q5402858)**, 2026-10-19: P625 30.0333, 32.55, by Suez. OpenBible resolves Etham as "another name for Pithom", so we sit on Pithom (Tell el-Retabeh, 30.5475, 31.9636), 80 km away. The station's site is unknown.
- **Kibroth Hattaavah (Q6404073)**, 2026-10-19: P625 28.9167, 34.4833. OpenBible and we are at Erweis el-Ebeirig (28.7887, 34.2754), 25 km. Unknown.
- **Arsinoe (Q3623994)**, 2026-10-19: P625 29.8975, 32.4606 and P1584 = 727101 "Clysma" (alias Arsinoe; the Barrington Atlas Directory: "Kum el-Qolzum/Suez"), at Suez. OpenBible's three top candidates have one vote each (the region between Maghfar and Lake Timsah, Kabret, Tall al Qulzum), and its comment cites Sidebotham and Mackay for Qulzum, Guthe for Fayed and Cohen for Kabret; the resolver took the first, so we are at 30.5667, 32.2667, 77 km north of Pleiades and Wikidata. No verse names the place. Disputed among named scholars; whether to follow Pleiades is for the owner.

## Pleiades: confirmed

None. Every Pleiades id I looked up in depth resolved and matched its description.

## Pleiades: to check

- **674270 Thapsacus**: `locationPrecision` is "rough", the place is tagged "unlocated", and the representative point is 31.5, 44.5 in southern Iraq. Its own description says the city "lay on the western bank of the Euphrates" and that the site is unknown. Anyone who uses `reprLat/reprLong` blindly will put Thapsacus about 770 km from where most proposals place it.
- **678086 Chalcis sub Libano**, 2026-10-19: the Barrington Atlas Directory note is "Husn esh-Shadur?" (BAtlas 69 D2), and the record's only location is DARMC's point from it (33.9577, 36.2416, in the Anti-Lebanon), with no description or connections of its own. OpenBible and we are at Anjar in the Beqaa (33.7258, 35.9297), 39 km away, the other proposal for the city. No verse names it. Disputed, not an error.

---

## Where we (History Globe) disagree with them, or are wrong ourselves

1. **Cnidus `ab793ce`**: our `pleiades` = 599576 (Burgaz), which comes from Wikidata's P1584 (W6). Our own coordinate is at Tekir, and Acts 27 is 1st century CE, when the city was at Tekir. **Fixed 2026-10-17: content/pleiades.json now has 599575.**
2. **Madmenah `a67297a`**: our `wikidata` = Q6728293 is Madmannah (O2), inherited from OpenBible. **Fixed 2026-10-17: left out in scripts/wikidata-links.ts.**
3. **Five disambiguation QIDs** (O3: Alemeth, Elath, Eshtemoa, Peor, Ramah `ad27541`) and **14 redirected QIDs** (O4) appeared as-is in our `places.json`. **Fixed 2026-10-17: the five are left out, the fourteen followed to the current item (scripts/wikidata-links.ts).**
4. **Rhodes `a4218ee`** (kind settlement, Acts 21:1) and **Rhodes `a8c207b`** (island) both pointed to Pleiades 590031 "Rhodos (island)". **Fixed 2026-10-19: the settlement now carries 590030 "Rhodos (settlement)"** (36.4431, 28.2276, 1.5 km from our point; the island centroid is 36 km off), attested from 1200 BC (`1200-bc-middle-east`) to the present, written as −1199 to 1300 like the other entries of content/pleiades.json (the span stops at 1300 there).
5. **Ramathaim-zophim `a54ef72`**: our `pleiades` = 688014 "Ramathaim/Arimathaia" (Rentis, via Wikidata Q1019146 P1584), but our coordinate (31.854, 35.232, Ramah/Nebi Samwil area) is 29 km away. The record contradicts itself. Either the coordinate or the link has to go. **2026-10-17: the Pleiades link is removed; which site is right is for the owner.**
6. **Tartessos `a86d7c7`**: Pleiades 256468 is "unlocated". Our point is 24 km from its representative point. Harmless, but it is a guess.
7. **Coordinates vs Theographic**: for 126 high-confidence matches, Theographic's point is more than 100 km from ours. Gone through one by one on 2026-10-19: 48 regions, 6 rivers, 6 bodies of water, 2 peoples, 1 canal and 1 mountain range are centroids and were set aside; for 107 of the 126 their point is their own `openBibleLat/Long` to the metre, that is the 2007 OpenBible data. Of the 43 settlements, 13 campsites, 5 mountains and 1 promontory left, every case where an independent source decides (Pleiades, Wikidata, the verse itself) decides for our point: Erech, Asshur, Pelusium, Punon, Hadrach, Jotbah, Tamar, Salmone, Rimmon of the Negeb, the two Janoahs, Hezron, Zeboim, Hosah, the Negeb towns of T21 and the stations of T22 (T14 to T22 and the "to check" items above). The rest are places nobody has located (the stations of Numbers 33, Dizahab, Luz of Judg 1:26, Ahava, Casiphia, Immer, Raamah, Baal-hamon, Gamad, Hazer-hatticon, Harmon, the northern Mount Hor, Zalmon, Nophah, Ain of Num 34:11, Avva, Sepharvaim, Canneh, Rehob, Aphik, Karkor, Dinhabah), where both points are proposals. None of our points was shown wrong; Wikidata's P625 disagrees with ours only for Pi-hahiroth (116 km), whose site is unknown.
8. **Verse coverage**: we count verses from all translations, so we have places with no KJV verse at all (Aram-naharaim in the Ps 60 heading, Zaphon, Rhodes in Ezek 27:15, etc.). Theographic is KJV/ESV-based. Those differences are **not** Theographic errors and I did not list them.
9. **OpenBible "same as" chains and TIPNR ids**: checked 2026-10-19 (O5, O6). Still not done: a full audit of Theographic verse tags for places outside the 16 names sampled in T10.
10. **Our points inherited O6**: nine places that OpenBible calls another name for a record sat 8 to 63 km from that record. **Fixed 2026-10-19 for seven: content/place-points.json puts each on the named record's point** (Dimonah, Bethul, Chesil, Canneh, Sea of Jazer, Ir-moab, Hukok; the reasons are in the file). Zer and Ramoth 2 were moved and taken back the same day on review: the named record's point fits their verses worse (O6). The mutual pairs and the Sea of Egypt are left as OpenBible has them.
11. **Our `tipnr` column** carried OpenBible's 2021 links as they were (O5): 763 of our 1128 did not match a current TIPNR unique name, 8 named the wrong record. **Fixed 2026-10-19: content/tipnr.json (scripts/tipnr-links.ts) follows each link to the current record; api/v1/places.json now carries it as `tipnr`, and places.csv keeps OpenBible's link as `openbible_tipnr`.** Beyond the River (`a88310a`) has no TIPNR record and no id.
12. **Ramah 6 `aaa4c6e` and Baalath-beer `a03cc2d`** (Josh.19.8 "Baalath-beer, Ramah of the Negeb"; 1Chr.4.33 "Baal") sit at Beer Yeroham (30.9910, 34.9113), the point OpenBible resolves for Baalath-beer, 34 km from Ramoth 2 (`ab049cf`), the same place under its 1Sam.30.27 name, at Horbat Uza (item 10, O6). Which site, if either, is for the owner.
13. **Habor `af19252` and Kidron `a553110`**: our `pleiades` ids came through Wikidata's P1584 (W7, W8). Habor (2Kgs.17.6, "Habor the river of Gozan"; our point is at its mouth by Circesium, and our article says it is the Khabur, "the largest tributary of the Euphrates in Syria") linked 874565, the Lesser Khabur of the Tigris, 321 km away; Kidron linked 687905 Gedros near Yavne, 44 km from Jerusalem. **Fixed 2026-10-19: content/pleiades.json gives Habor 893928 "Aborras/Chaboras (river)" and has no Kidron entry**, since Pleiades has no record of the valley.
14. **Aphek 3 `a6fc60d` and Kedesh 3 `adb5ae4`**: our `wikidata` carried OpenBible's links (O7): the article for all the Apheks, placed at the Aphek of Sharon, and the tell Tell Abu Qedeis, OpenBible's runner-up for a place it resolves to Kishion. **Fixed 2026-10-19: both left out in scripts/wikidata-links.ts.** Our points stay: Aphek of Aram at Tel Ein Gev east of the Sea of Galilee, where 1Kgs.20.26 and 2Kgs.13.17 put the wars with Aram, and Kedesh of Issachar on Kishion (Josh.21.28 and 1Chr.6.72 are the same Levitical list). Whether Kedesh of Issachar is rather Tell Abu Qedeis is for the owner, as with item 5.
15. **Settlements more than 20 km from their Pleiades or Wikidata point, left as they are** (2026-10-19): Golan 32 km (Wikidata is wrong, W9); Jotbathah 47, Chalcis 39 (Pleiades), Achshaph 23, Zarethan 22, Hukkok 20 and Arsinoe 77 (two or three named proposals each; ours is one of them: the "to check" items above); Etham 80 and Kibroth-hattaavah 25 (unlocated stations). Our point was shown wrong in none. Two records assert one candidate by their link and another by their point, like Ramathaim-zophim (item 5): Hukkok (`Q18608506` is Yaquq; our point is Khirbet el-Jemeijimeh) and, before item 14, Kedesh 3. Hukkok's link is kept, since the item's article is also the biblical town's; which site is right is for the owner.
