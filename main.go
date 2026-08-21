package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"webssh/controller"
	"webssh/core/configstore"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

//go:embed web/dist/*
var f embed.FS

var (
	port       = flag.Int("p", 5032, "服务运行端口")
	v          = flag.Bool("v", false, "显示版本号")
	authInfo   = flag.String("a", "", "开启账号密码登录验证, '-a user:pass'的格式传参")
	configPath = flag.String("c", "./data", "连接与常用命令配置目录")
	timeout    int
	savePass   bool
	version    string
	buildDate  string
	goVersion  string
	gitVersion string
	username   string
	password   string
)

func init() {
	flag.IntVar(&timeout, "t", 120, "ssh连接超时时间(min)")
	flag.BoolVar(&savePass, "s", true, "保存ssh密码")
	if envVal, ok := os.LookupEnv("savePass"); ok {
		if b, err := strconv.ParseBool(envVal); err == nil {
			savePass = b
		}
	}
	if envVal, ok := os.LookupEnv("authInfo"); ok {
		*authInfo = envVal
	}
	if envVal, ok := os.LookupEnv("port"); ok {
		if b, err := strconv.Atoi(envVal); err == nil {
			*port = b
		}
	}
	if envVal, ok := os.LookupEnv("CONFIG_PATH"); ok && envVal != "" {
		*configPath = envVal
	}
	flag.Parse()
	if *v {
		fmt.Printf("Version: %s\n\n", version)
		fmt.Printf("BuildDate: %s\n\n", buildDate)
		fmt.Printf("GoVersion: %s\n\n", goVersion)
		fmt.Printf("GitVersion: %s\n\n", gitVersion)
		os.Exit(0)
	}
	if *authInfo != "" {
		accountInfo := strings.Split(*authInfo, ":")
		if len(accountInfo) != 2 || accountInfo[0] == "" || accountInfo[1] == "" {
			fmt.Println("请按'user:pass'的格式来传参或设置环境变量, 且账号密码都不能为空!")
			os.Exit(0)
		}
		username, password = accountInfo[0], accountInfo[1]
	}
}

func staticRouter(router *gin.Engine) {
	if password != "" {
		accountList := map[string]string{
			username: password,
		}
		authorized := router.Group("/", gin.BasicAuth(accountList))
		authorized.GET("", func(c *gin.Context) {
			indexHTML, _ := f.ReadFile("web/dist/" + "index.html")
			c.Writer.Write(indexHTML)
		})
	} else {
		router.GET("/", func(c *gin.Context) {
			indexHTML, _ := f.ReadFile("web/dist/" + "index.html")
			c.Writer.Write(indexHTML)
		})
	}
	staticFs, _ := fs.Sub(f, "web/dist/static")
	router.StaticFS("/static", http.FS(staticFs))
}

func main() {
	server := gin.Default()
	server.SetTrustedProxies(nil)
	server.Use(gzip.Gzip(gzip.DefaultCompression))
	staticRouter(server)
	store, err := configstore.New(*configPath, savePass)
	if err != nil {
		panic(err)
	}
	server.GET("/connections", func(c *gin.Context) {
		list, err := store.LoadConnections()
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, list)
	})
	server.PUT("/connections", func(c *gin.Context) {
		var list []map[string]interface{}
		if err := c.ShouldBindJSON(&list); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		if list == nil {
			list = []map[string]interface{}{}
		}
		if err := store.SaveConnections(list); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, list)
	})
	server.GET("/commands", func(c *gin.Context) {
		list, err := store.LoadCommands()
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, list)
	})
	server.PUT("/commands", func(c *gin.Context) {
		var list []map[string]interface{}
		if err := c.ShouldBindJSON(&list); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		if list == nil {
			list = []map[string]interface{}{}
		}
		if err := store.SaveCommands(list); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, list)
	})
	server.GET("/term", func(c *gin.Context) {
		controller.TermWs(c, time.Duration(timeout)*time.Minute)
	})
	server.GET("/check", func(c *gin.Context) {
		responseBody := controller.CheckSSH(c)
		responseBody.Data = map[string]interface{}{
			"savePass": savePass,
		}
		c.JSON(200, responseBody)
	})
	file := server.Group("/file")
	{
		file.GET("/list", func(c *gin.Context) {
			c.JSON(200, controller.FileList(c))
		})
		file.GET("/download", func(c *gin.Context) {
			controller.DownloadFile(c)
		})
		file.POST("/upload", func(c *gin.Context) {
			c.JSON(200, controller.UploadFile(c))
		})
		file.GET("/progress", func(c *gin.Context) {
			controller.UploadProgressWs(c)
		})
	}
	server.Run(fmt.Sprintf(":%d", *port))
}
