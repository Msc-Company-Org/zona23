// Locais de votação e seções da 23ª Zona Eleitoral (informação pública: endereços e seções
// são divulgados pela Justiça Eleitoral). Contatos de direção e de pessoas não ficam aqui.
// Fontes: Planejamento Logístico 2026 do cartório (áreas, BPM, endereços) e relatório do ELO
// "Endereço das Seções" (códigos, bairros, aptos e acessibilidade). Seções conferidas com o TSE.
const ENDERECOS = {
  "E.M. Madre Benedita": "Rua Osman Lins, 516|21670-450",
  "C.E. Joel de Oliveira": "Rua Pastor José Ramalho, 98|21670-200",
  "E.M. Juracy Silveira": "Rua Pastor José Ramalho, 98|21670-200",
  "E.M. Lia Braga de Faria": "Rua Nova Trento, 327|21670-440",
  "E.M. Baden Powell": "Rua Nova Trento, 28|21670-440",
  "Colégio Pio XII – Matiola": "Rua Matiola, 305|21670-410",
  "E.M. Rose Klabin": "Rua Reginópolis, 135|21675-440",
  "E.M. Oswaldo Goeldi": "Rua Antônio Maria, s/n|21675-180",
  "CIEP João do Rio": "Rua Pinheiro Bittencourt, s/n|21675-130",
  "E.M. Isaías Alves": "Rua Dom José de Souza, s/n (Jardim Santo Antônio)|21675-040",
  "E.M. Emílio Carlos": "Rua Pinheiro Bittencourt, s/n|21675-130",
  "Rede Elite – Shopping Jardim Guadalupe": "Avenida Brasil, 22.155|21670-000",
  "E.M. Prof. Álvaro Espinheira": "Rua Nelson Meireles Neto, s/n|21660-520",
  "Colégio Mercedário Pio XII – Mercês": "Rua Francisco Portela, 126|21660-010",
  "Colégio Marechal Lott": "Rua Clodoaldo de Freitas, 65|21660-300",
  "E.M. Gilberto Amado": "Rua Professor Valdemar Raythe, s/n|21665-280",
  "E.M. Bélgica": "Rua Francolim, 50|21660-130",
  "E.M. Maurice Maeterlinck": "Rua Bétula, 50|21660-100",
  "E.E.I. Ernani Cardoso": "Rua Francolim, 50|21660-080",
  "E.M. Piauí": "Avenida Brasil, 23.364|21660-001",
  "Centro Educacional Santa Mônica": "Rua Divisória, 79|21331-250",
  "Centro Tecnológico Rio (CT-Rio)": "Rua Divisória, 48|21331-250",
  "E.M. Francisco Palheta": "Rua Abílio dos Santos, 100|21331-290",
  "E.M. Miguel de Cervantes": "Rua Abílio dos Santos, 170|21331-290",
  "E.E. Prof. José Accioli": "Rua Costa Filho, 500|21610-570",
  "Centro Educacional Triângulo": "Rua João Vicente, 1.355|21331-260",
  "Colégio Progressão": "Rua João Vicente, 1.521|21610-210",
  "Colégio Américo de Oliveira": "Avenida Engenheiro Assis Ribeiro, 433|21610-220",
  "E.M. Evangelina Duarte Batista": "Praça 15 de Novembro, 28|21610-490",
  "E.M. Santos Dumont": "Praça 15 de Novembro, 29|21610-490",
  "E.T.E. Visconde de Mauá (FAETEC)": "Rua João Vicente, 1.775|21610-210",
  "E.M. Rosa da Fonseca": "Praça Marechal Hermes, s/n|21615-140"
};

// [área, código ELO, nome, bairro, BPM, seções previstas, [[seção, eleitores aptos, acessível?], …]]
// Códigos, bairros, aptos e acessibilidade: ELO "Endereço das Seções" de 06/10/2026 (225 seções, 79.560 eleitores).
export const LOCAIS = [
  ["A", "1309", "E.M. Madre Benedita", "Guadalupe", "14º", 7, [[166, 377, 1], [167, 372, 1], [168, 377, 1], [359, 376, 1], [427, 377, 1], [469, 378, 1]]],
  ["A", "1260", "C.E. Joel de Oliveira", "Deodoro", "14º", 10, [[145, 387, 1], [146, 380, 1], [147, 379, 1], [148, 381, 1], [149, 382, 1], [150, 378, 1], [366, 384, 1], [428, 380, 1], [587, 341]]],
  ["A", "1333", "E.M. Juracy Silveira", "Deodoro", "14º", 8, [[141, 319], [142, 318], [143, 321], [144, 320], [179, 321], [180, 317], [436, 320], [466, 337, 1]]],
  ["B", "1295", "E.M. Lia Braga de Faria", "Guadalupe", "41º", 6, [[161, 301, 1], [162, 304, 1], [163, 300, 1], [164, 301, 1], [165, 302, 1], [489, 301, 1]]],
  ["B", "1287", "E.M. Baden Powell", "Deodoro", "41º", 5, [[159, 320, 1], [160, 322, 1], [381, 324, 1], [478, 325, 1]]],
  ["B", "1279", "Colégio Pio XII – Matiola", "Deodoro", "41º", 14, [[151, 349, 1], [152, 351, 1], [153, 353, 1], [154, 348, 1], [155, 352, 1], [156, 350, 1], [157, 352, 1], [158, 352, 1], [401, 351, 1], [477, 351, 1]]],
  ["C", "1325", "E.M. Rose Klabin", "Guadalupe", "41º", 10, [[174, 401], [175, 400], [176, 400], [177, 402], [178, 400], [353, 399], [474, 412, 1]]],
  ["C", "1317", "E.M. Oswaldo Goeldi", "Guadalupe", "9º", 5, [[169, 389, 1], [170, 387, 1], [171, 391, 1], [172, 388, 1], [173, 390, 1]]],
  ["D", "1635", "CIEP João do Rio", "Guadalupe", "41º", 9, [[222, 390, 1], [382, 388, 1], [429, 394, 1], [465, 398, 1], [482, 394, 1], [486, 412, 1], [488, 398, 1], [493, 402, 1], [586, 264]]],
  ["D", "1430", "E.M. Isaías Alves", "Guadalupe", "41º", 10, [[224, 393], [225, 390], [226, 392], [227, 399], [228, 388], [476, 405, 1]]],
  ["D", "1422", "E.M. Emílio Carlos", "Guadalupe", "41º", 5, [[219, 426, 1], [220, 426, 1], [221, 423, 1], [223, 427, 1], [471, 424, 1]]],
  ["D", "1368", "Rede Elite – Shopping Jardim Guadalupe", "Guadalupe", "41º", 9, [[188, 340], [189, 336], [190, 342], [191, 340], [192, 337], [369, 335], [444, 340], [458, 339, 1]]],
  ["E", "1627", "E.M. Prof. Álvaro Espinheira", "Guadalupe", "41º", 8, [[483, 378, 1], [487, 380], [491, 380], [585, 384]]],
  ["E", "1600", "Colégio Mercedário Pio XII – Mercês", "Guadalupe", "41º", 8, [[481, 418, 1], [484, 418, 1], [485, 416, 1], [492, 418, 1]]],
  ["E", "1619", "Colégio Marechal Lott", "Guadalupe", "41º", 5, [[448, 412, 1], [459, 410, 1], [473, 407, 1], [480, 409, 1], [494, 411, 1]]],
  ["F", "1376", "E.M. Gilberto Amado", "Guadalupe", "41º", 10, [[181, 295, 1], [182, 293, 1], [193, 295, 1], [194, 293, 1], [195, 291, 1], [472, 290, 1], [479, 293, 1], [490, 291, 1]]],
  ["F", "1350", "E.M. Bélgica", "Guadalupe", "41º", 15, [[183, 411], [184, 410, 1], [185, 413, 1], [186, 412], [187, 412], [306, 416], [307, 410], [308, 412], [309, 411, 1], [310, 412, 1], [356, 406], [391, 410], [410, 411], [434, 411], [475, 411, 1]]],
  ["G", "1384", "E.M. Maurice Maeterlinck", "Guadalupe", "41º", 6, [[196, 378], [197, 379], [198, 372], [199, 378], [200, 370], [371, 383, 1]]],
  ["G", "1180", "E.E.I. Ernani Cardoso", "Guadalupe", "41º", 5, [[100, 359], [101, 355], [102, 350], [443, 351], [470, 366, 1]]],
  ["G", "1392", "E.M. Piauí", "Guadalupe", "41º", 8, [[201, 371, 1], [202, 372, 1], [203, 371, 1], [204, 369, 1], [451, 368, 1]]],
  ["H", "1694", "Centro Educacional Santa Mônica", "Bento Ribeiro", "9º", 30, [[531, 283], [532, 314, 1], [533, 284], [534, 286], [535, 284], [536, 285], [537, 282], [538, 285], [539, 283], [540, 283], [541, 284], [542, 284]]],
  ["H", "1724", "Centro Tecnológico Rio (CT-Rio)", "Bento Ribeiro", "9º", 10, [[558, 361], [559, 355], [560, 357], [561, 358], [562, 363, 1]]],
  ["I", "1716", "E.M. Francisco Palheta", "Bento Ribeiro", "9º", 10, [[548, 305], [549, 313, 1], [550, 305], [551, 304], [552, 304], [553, 303], [554, 303], [555, 304], [556, 301], [557, 305]]],
  ["I", "1740", "E.M. Miguel de Cervantes", "Bento Ribeiro", "9º", 6, [[574, 248], [575, 246], [576, 247], [577, 250, 1], [578, 249], [579, 247]]],
  ["I", "1651", "E.E. Prof. José Accioli", "Marechal Hermes", "9º", 10, [[505, 363], [506, 365], [507, 367], [508, 362], [509, 363], [510, 371, 1], [511, 363]]],
  ["J", "1660", "Centro Educacional Triângulo", "Bento Ribeiro", "9º", 8, [[512, 329], [513, 332], [514, 326], [515, 328], [516, 326, 1]]],
  ["J", "1643", "Colégio Progressão", "Marechal Hermes", "9º", 10, [[495, 344, 1], [496, 344, 1], [497, 342, 1], [498, 345, 1], [499, 341, 1], [500, 341], [501, 341], [502, 341], [503, 342], [504, 345]]],
  ["L", "1678", "Colégio Américo de Oliveira", "Marechal Hermes", "9º", 7, [[517, 403], [518, 402], [519, 405, 1], [520, 401], [521, 405]]],
  ["L", "1732", "E.M. Evangelina Duarte Batista", "Marechal Hermes", "9º", 11, [[563, 381], [564, 385], [565, 385], [566, 383], [567, 387], [568, 403, 1], [569, 385], [570, 385], [571, 388], [572, 381], [573, 386]]],
  ["L", "1686", "E.M. Santos Dumont", "Marechal Hermes", "9º", 10, [[522, 377], [523, 377], [524, 378], [525, 378], [526, 378], [527, 388, 1], [528, 376], [529, 376], [530, 379]]],
  ["M", "1708", "E.T.E. Visconde de Mauá (FAETEC)", "Marechal Hermes", "14º", 15, [[543, 275, 1], [544, 275, 1], [545, 272, 1], [546, 274, 1], [547, 273, 1]]],
  ["N", "1759", "E.M. Rosa da Fonseca", "Vila Militar", "14º", 8, [[580, 254, 1], [581, 250, 1], [582, 256, 1], [583, 249, 1], [584, 250, 1]]],
].map(([area, codigo, nome, bairro, bpm, previstas, lista], index) => {
  const [endereco, cep] = ENDERECOS[nome].split("|");
  return {
    id: index + 1,
    area,
    codigo,
    nome,
    bairro,
    bpm,
    endereco,
    cep,
    previstas,
    eleitores: lista.reduce((total, [, aptos]) => total + aptos, 0),
    secoes: lista.map(([secao]) => secao),
    detalhes: lista.map(([secao, aptos, acessivel]) => ({ secao, aptos, acessivel: Boolean(acessivel) })),
  };
});

export const SECAO_LOCAL = new Map(LOCAIS.flatMap((local) => local.secoes.map((secao) => [secao, local])));
export const SECAO_INFO = new Map(LOCAIS.flatMap((local) => local.detalhes.map((info) => [info.secao, info])));
