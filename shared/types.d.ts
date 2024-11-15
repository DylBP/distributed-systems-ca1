// export type Language = 'English' | 'Frenc

export type RetroGame = {
  id: number,
  title: string,
  genre: string[],
  platform: string,       
  release_date: string,   
  developer: string,      
  publisher: string,      
  description: string,    
  cover_art_path: string, 
  screenshots: string[],  
  rating: number,         
  popularity: number,     
  multiplayer: boolean,   
  average_score: number,  
  review_count: number    
}

export type RetroGameQueryParams = {
  title: string
}

export type SignUpBody = {
  username: string;
  password: string;
  email: string
}

export type ConfirmSignUpBody = {
  username: string;
  code: string;
}

export type SignInBody = {
  username: string;
  password: string;
}