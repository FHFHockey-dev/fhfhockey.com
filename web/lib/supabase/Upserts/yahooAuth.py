# App ID
# GGs3JoK2

# Client ID (Consumer Key)
# dj0yJmk9bEpIYzdZcUlTd0czJmQ9WVdrOVIwZHpNMHB2U3pJbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTVj

# Client Secret (Consumer Secret)
# a9deb4c177fdc8244141d07301ad8e513821010b

# Callback URL
# https://www.fhfhockey.com

# Access Token: Z4gUE42ZsAiRuGrXctAy1Ys3uC8X5LKdk4k8.VYgp_umUOQxX3apVDmmjWEeSOms8c5x_Qf9HugffmkMM5V8w_23wC2_aEJnyOXJydfJiSWky6BD_4Y6Rc.rtpfFRicByiSE0ew6bwxMSZSlIttDJnl9lQvAhzRwa.EZ5dxb2Xx_mZ7_EPIuhzI2_h0i_EVMaojlapuTuuBwOxHtcUpo0gw0DwSW4ZDy5J5GlzjiAN5Zxh6gKZRd67btIfTdfia_ZqctIiOFX5YTceSeJmjpbOJzVZfW7jkhSBGQiyL7bjIkn503eQ_zTl8kBj0eOYZHYN4B7.tcGDpxWYZBMViYzWLTsJ6kZELr3OOye5l2LpJUOipqCHc_jikofKQQYWb_YdpoMe3EIzGYIv6XiJ7u8.zV83uWYSlw0e5rz4ti45TmATH1wn_dj0QMlIgfc4UtjhyEnUD8su_AT3zj_T6tFTDGkRz3RmrR._OkEN12f4O8Ddx4fKXRPI7yPF98q._lc9r7bNsbmqrRJswBBmymb3ycF9dpqn4RJVaUoEhrQSC46d9IYeJEQDpz2RH_go4w1ytet8q8.UvWxktoS0EOBfRJxdOIo8KOso0L4ecl5hVmJIVs37hqvepIKnIuSoIsdbmSl7R5f.HqY1C_3sLUbgUINcADeqr_7.SaHB6kQhfmdpNmz5PF6UPx.N7B1Qg4DqrSThUpRPiJpf5xG8yC6mV3PT6EUhNCLxvcj_itdN6M49OPmJizmwkrhxYLw_xgSAJ3rX6rY8tcbFg7oJFIwB3Cn7WthEiTZFfiyC7mN1r3Nxg6k5nuAILCTr2ZlwcJ5i7LRTt8CUdhd_gtvt4daDvDa.pwOkFp8SJu4wEFzxLAgWmQgO.jS33vM9kSZWkvILYOJIeOFZfKb4fnI5qO.sHB8y2wt4.6U2RcSr4Lkj22BillkVFQqAkAKjD7e6ujtwARKvfqFLCwJGMX.URVnSsvj8v3uYZMhUs7N7UMW3xTU4EkGrCzZKqFVoSu7rSkkLhQeWLQVg--
# League Key
# 105954

# API Endpoint:
# https://fantasysports.yahooapis.com/fantasy/v2/league/117061/players;status=FA

import requests
from urllib.parse import urlencode

# Constants for the OAuth process
CLIENT_ID = 'dj0yJmk9bEpIYzdZcUlTd0czJmQ9WVdrOVIwZHpNMHB2U3pJbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTVj'
CLIENT_SECRET = 'a9deb4c177fdc8244141d07301ad8e513821010b'
REDIRECT_URI = 'https://www.fhfhockey.com'
AUTHORIZATION_URL = 'https://api.login.yahoo.com/oauth2/request_auth'
TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token'

def get_authorization_url():
    # Prepare the query parameters
    params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'language': 'en-us'
    }
    # Create the URL for authorization
    url = f"{AUTHORIZATION_URL}?{urlencode(params)}"
    return url

def get_access_token(authorization_code):
    # Prepare the data for the token request
    data = {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
        'code': authorization_code,
        'grant_type': 'authorization_code'
    }
    # Make the request to get the token
    response = requests.post(TOKEN_URL, data=data)
    response_data = response.json()
    return response_data['access_token']

# Start the process
print("Visit this URL to authorize:", get_authorization_url())
authorization_code = input("Enter the authorization code: ")
access_token = get_access_token(authorization_code)
print("Access Token:", access_token)

# Access Token: Z4gUE42ZsAiRuGrXctAy1Ys3uC8X5LKdk4k8.VYgp_umUOQxX3apVDmmjWEeSOms8c5x_Qf9HugffmkMM5V8w_23wC2_aEJnyOXJydfJiSWky6BD_4Y6Rc.rtpfFRicByiSE0ew6bwxMSZSlIttDJnl9lQvAhzRwa.EZ5dxb2Xx_mZ7_EPIuhzI2_h0i_EVMaojlapuTuuBwOxHtcUpo0gw0DwSW4ZDy5J5GlzjiAN5Zxh6gKZRd67btIfTdfia_ZqctIiOFX5YTceSeJmjpbOJzVZfW7jkhSBGQiyL7bjIkn503eQ_zTl8kBj0eOYZHYN4B7.tcGDpxWYZBMViYzWLTsJ6kZELr3OOye5l2LpJUOipqCHc_jikofKQQYWb_YdpoMe3EIzGYIv6XiJ7u8.zV83uWYSlw0e5rz4ti45TmATH1wn_dj0QMlIgfc4UtjhyEnUD8su_AT3zj_T6tFTDGkRz3RmrR._OkEN12f4O8Ddx4fKXRPI7yPF98q._lc9r7bNsbmqrRJswBBmymb3ycF9dpqn4RJVaUoEhrQSC46d9IYeJEQDpz2RH_go4w1ytet8q8.UvWxktoS0EOBfRJxdOIo8KOso0L4ecl5hVmJIVs37hqvepIKnIuSoIsdbmSl7R5f.HqY1C_3sLUbgUINcADeqr_7.SaHB6kQhfmdpNmz5PF6UPx.N7B1Qg4DqrSThUpRPiJpf5xG8yC6mV3PT6EUhNCLxvcj_itdN6M49OPmJizmwkrhxYLw_xgSAJ3rX6rY8tcbFg7oJFIwB3Cn7WthEiTZFfiyC7mN1r3Nxg6k5nuAILCTr2ZlwcJ5i7LRTt8CUdhd_gtvt4daDvDa.pwOkFp8SJu4wEFzxLAgWmQgO.jS33vM9kSZWkvILYOJIeOFZfKb4fnI5qO.sHB8y2wt4.6U2RcSr4Lkj22BillkVFQqAkAKjD7e6ujtwARKvfqFLCwJGMX.URVnSsvj8v3uYZMhUs7N7UMW3xTU4EkGrCzZKqFVoSu7rSkkLhQeWLQVg--