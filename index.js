const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const multer = require("multer");

const fs = require("fs");

const FormData = require("form-data");

// const { init: initDB, Counter } = require("./db");

const logger = morgan("tiny");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

const upload = multer({ dest: "uploads/" }); // 配置上传临时目录

// 配置微信参数
const WECHAT_CONFIG = {
  appid: process.env.WECHAT_APPID, // 建议使用环境变量
  secret: process.env.WECHAT_SECRET,
};

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// // 更新计数
// app.post("/api/count", async (req, res) => {
//   const { action } = req.body;
//   if (action === "inc") {
//     await Counter.create();
//   } else if (action === "clear") {
//     await Counter.destroy({
//       truncate: true,
//     });
//   }
//   res.send({
//     code: 0,
//     data: await Counter.count(),
//   });
// });

// // 获取计数
// app.get("/api/count", async (req, res) => {
//   const result = await Counter.count();
//   res.send({
//     code: 0,
//     data: result,
//   });
// });

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

// 获取微信access_token
app.get("/api/wx/token", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.weixin.qq.com/cgi-bin/token",
      {
        params: {
          grant_type: "client_credential",
          appid: WECHAT_CONFIG.appid,
          secret: WECHAT_CONFIG.secret,
        },
      }
    );

    res.send({
      code: 200,
      data: response.data,
    });
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

app.get("/api/wx/datacube", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.weixin.qq.com/datacube/getarticlesummary`,
      {
        begin_date: "2025-04-01",
        end_date: "2025-04-24",
      }
    );
    res.send(response.data);
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 修改为 POST 请求，并使用 multer 处理文件上传
app.post("/api/wx/uploadimg", upload.single("media"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({
        code: -1,
        error: "请上传文件",
      });
    }

    const formData = new FormData();
    formData.append("media", fs.createReadStream(req.file.path));

    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${req.query.access_token}`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    // 确保清理临时文件
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

const port = process.env.PORT || 80;

async function bootstrap() {
  // await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
