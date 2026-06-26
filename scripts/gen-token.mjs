import crypto from "crypto";
const SECRET = "19ffd8d4a3a21dad52beec6bdc981735f25c5ee8d27dcb5f4bad75c97495db28";
const exp = Math.floor(Date.now() / 1000) + 28800;
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  login: "admin",
  categoria: "admin",
  permissoes: {
    financeiro: ["ver","editar","criar","excluir"],
    remuneracoes: ["ver","editar","criar","excluir"],
  },
  exp
};
const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
console.log(payload + "." + sig);
