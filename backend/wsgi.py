from app import create_app

app, _ = create_app("production")

if __name__ == "__main__":
    app.run()
