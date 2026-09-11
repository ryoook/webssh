package core

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net"
	"strconv"
	"testing"

	"golang.org/x/crypto/ssh"
)

func TestDecodedMsgToSSHClientDefaultsRequestTTYToTrue(t *testing.T) {
	sshInfo := base64.StdEncoding.EncodeToString([]byte(`{"username":"root","ipaddress":"127.0.0.1","port":22}`))

	client, err := DecodedMsgToSSHClient(sshInfo)
	if err != nil {
		t.Fatal(err)
	}
	if !client.ShouldRequestTTY() {
		t.Fatal("legacy connection should request a pseudo-terminal")
	}
}

func TestDecodedMsgToSSHClientCanDisableRequestTTY(t *testing.T) {
	sshInfo := base64.StdEncoding.EncodeToString([]byte(`{"username":"root","ipaddress":"127.0.0.1","port":22,"requesttty":false}`))

	client, err := DecodedMsgToSSHClient(sshInfo)
	if err != nil {
		t.Fatal(err)
	}
	if client.ShouldRequestTTY() {
		t.Fatal("connection should not request a pseudo-terminal when requesttty is false")
	}
}

func TestDecodedMsgToSSHClientIncludesStartupCommand(t *testing.T) {
	sshInfo := base64.StdEncoding.EncodeToString([]byte(`{"username":"root","ipaddress":"127.0.0.1","port":22,"command":"cd /data/project && bash"}`))

	client, err := DecodedMsgToSSHClient(sshInfo)
	if err != nil {
		t.Fatal(err)
	}
	if client.Command != "cd /data/project && bash" {
		t.Fatalf("unexpected startup command: %q", client.Command)
	}
}

func TestGenerateClientSupportsKeyboardInteractivePassword(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	hostKey, err := ssh.NewSignerFromKey(privateKey)
	if err != nil {
		t.Fatal(err)
	}

	serverConfig := &ssh.ServerConfig{
		KeyboardInteractiveCallback: func(
			conn ssh.ConnMetadata,
			challenge ssh.KeyboardInteractiveChallenge,
		) (*ssh.Permissions, error) {
			answers, err := challenge("", "", []string{"Password: "}, []bool{false})
			if err != nil {
				return nil, err
			}
			if conn.User() != "test-user" || len(answers) != 1 || answers[0] != "test-password" {
				return nil, fmt.Errorf("invalid credentials")
			}
			return nil, nil
		},
	}
	serverConfig.AddHostKey(hostKey)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()

	go func() {
		conn, acceptErr := listener.Accept()
		if acceptErr != nil {
			return
		}
		defer conn.Close()
		serverConn, _, _, handshakeErr := ssh.NewServerConn(conn, serverConfig)
		if handshakeErr == nil {
			defer serverConn.Close()
		}
	}()

	port := listener.Addr().(*net.TCPAddr).Port
	client := SSHClient{
		Username:  "test-user",
		Password:  "test-password",
		IPAddress: "127.0.0.1",
		Port:      port,
		LoginType: 0,
	}

	if err := client.GenerateClient(); err != nil {
		t.Fatalf("keyboard-interactive authentication failed on port %s: %v", strconv.Itoa(port), err)
	}
	client.Close()
}
